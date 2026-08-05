import {
  saveGame,
  getGames,
  getGameById,
  deleteGame,
  getGameCount,
} from './gameHistory';
import { historySupabase } from '../supabaseClient';
import { getHistoryOwnerId } from './gameHistoryAuth';

jest.mock('../supabaseClient', () => ({
  historySupabase: {
    from: jest.fn(),
  },
}));

jest.mock('./gameHistoryAuth', () => ({
  getHistoryOwnerId: jest.fn(),
}));

const ownerId = '00000000-0000-4000-8000-000000000001';

function createChain(result = { data: [], error: null }) {
  const chain = {
    insert: jest.fn(() => chain),
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    order: jest.fn(() => chain),
    range: jest.fn(() => chain),
    delete: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

describe('gameHistory ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getHistoryOwnerId.mockResolvedValue(ownerId);
  });

  test('saves games with auth ownership and retains multiplayer metadata', async () => {
    const chain = createChain({ data: { id: 42 }, error: null });
    historySupabase.from.mockReturnValue(chain);

    await expect(saveGame({ pgn: '1. e4' })).resolves.toEqual({ id: 42 });
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: ownerId,
      player_id: expect.stringMatching(/^player_/),
    }));
  });

  test('scopes list reads to the anonymous auth owner ID', async () => {
    const chain = createChain({ data: [{ id: 42 }], error: null });
    historySupabase.from.mockReturnValue(chain);

    await expect(getGames()).resolves.toEqual([{ id: 42 }]);
    expect(chain.eq).toHaveBeenCalledWith('owner_id', ownerId);
  });

  test('scopes single-game reads to the anonymous auth owner ID', async () => {
    const chain = createChain({ data: { id: 42 }, error: null });
    historySupabase.from.mockReturnValue(chain);

    await expect(getGameById(42)).resolves.toEqual({ id: 42 });
    expect(chain.eq).toHaveBeenCalledWith('id', 42);
    expect(chain.eq).toHaveBeenCalledWith('owner_id', ownerId);
  });

  test('deletes an owned game through RLS-scoped table access', async () => {
    const chain = createChain({ data: [{ id: 42 }], error: null });
    historySupabase.from.mockReturnValue(chain);

    await expect(deleteGame(42)).resolves.toBe(true);
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 42);
    expect(chain.eq).toHaveBeenCalledWith('owner_id', ownerId);
  });

  test('returns false when RLS finds no owned row to delete', async () => {
    const chain = createChain({ data: [], error: null });
    historySupabase.from.mockReturnValue(chain);

    await expect(deleteGame(99)).resolves.toBe(false);
    expect(chain.eq).toHaveBeenCalledWith('owner_id', ownerId);
  });

  test('fails closed when anonymous auth is unavailable', async () => {
    getHistoryOwnerId.mockResolvedValue(null);
    const chain = createChain();
    historySupabase.from.mockReturnValue(chain);

    await expect(saveGame({ pgn: '1. e4' })).resolves.toBeNull();
    await expect(getGames()).resolves.toBeNull();
    await expect(getGameById(42)).resolves.toBeNull();
    await expect(deleteGame(42)).resolves.toBe(false);
    await expect(getGameCount()).resolves.toBe(0);
    expect(historySupabase.from).not.toHaveBeenCalled();
  });
});
