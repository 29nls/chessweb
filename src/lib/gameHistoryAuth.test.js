import { historySupabase } from '../supabaseClient';
import { getHistoryOwnerId } from './gameHistoryAuth';

jest.mock('../supabaseClient', () => ({
  historySupabase: {
    auth: {
      getSession: jest.fn(),
      signInAnonymously: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

async function loadAuthModuleFresh() {
  jest.resetModules();
  jest.doMock('../supabaseClient', () => ({ historySupabase }));
  return import('./gameHistoryAuth');
}

describe('getHistoryOwnerId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the existing anonymous session user ID', async () => {
    historySupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-existing', is_anonymous: true } } },
      error: null,
    });

    await expect(getHistoryOwnerId()).resolves.toBe('user-existing');
    expect(historySupabase.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  test('creates an anonymous session when no session exists', async () => {
    historySupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    historySupabase.auth.signInAnonymously.mockResolvedValue({
      data: { user: { id: 'user-anonymous', is_anonymous: true } },
      error: null,
    });

    await expect(getHistoryOwnerId()).resolves.toBe('user-anonymous');
    expect(historySupabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  test('does not use a non-anonymous existing session', async () => {
    historySupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-real', is_anonymous: false } } },
      error: null,
    });
    historySupabase.auth.signOut.mockResolvedValue({ error: null });
    historySupabase.auth.signInAnonymously.mockResolvedValue({
      data: { user: { id: 'user-anonymous', is_anonymous: true } },
      error: null,
    });

    await expect(getHistoryOwnerId()).resolves.toBe('user-anonymous');
    expect(historySupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  test('fails closed when an existing session cannot be signed out', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    historySupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-real', is_anonymous: false } } },
      error: null,
    });
    historySupabase.auth.signOut.mockResolvedValue({ error: { message: 'sign-out failed' } });

    await expect(getHistoryOwnerId()).resolves.toBeNull();
    expect(historySupabase.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('returns null and warns when anonymous sign-in fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    historySupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    historySupabase.auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: { message: 'Anonymous sign-ins disabled' },
    });

    await expect(getHistoryOwnerId()).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('shares one in-flight initialization for concurrent callers', async () => {
    const freshModule = await loadAuthModuleFresh();
    let resolveSignIn;
    historySupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    historySupabase.auth.signInAnonymously.mockReturnValue(new Promise((resolve) => {
      resolveSignIn = resolve;
    }));

    const first = freshModule.getHistoryOwnerId();
    const second = freshModule.getHistoryOwnerId();
    resolveSignIn({ data: { user: { id: 'user-anonymous', is_anonymous: true } }, error: null });

    await expect(Promise.all([first, second])).resolves.toEqual(['user-anonymous', 'user-anonymous']);
    expect(historySupabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
