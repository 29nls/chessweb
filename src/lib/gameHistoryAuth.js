import { historySupabase } from '../supabaseClient';

let ownerIdPromise = null;

/**
 * Get the Supabase user ID used only for saved-game ownership.
 * This intentionally does not use getPlayerId(), which remains the identity
 * used by the unauthenticated multiplayer protocol.
 *
 * @returns {Promise<string|null>} Auth user ID, or null when unavailable
 */
export function getHistoryOwnerId() {
  if (ownerIdPromise) return ownerIdPromise;

  const promise = initializeHistoryOwnerId();
  ownerIdPromise = promise;
  promise.then(
    () => { if (ownerIdPromise === promise) ownerIdPromise = null; },
    () => { if (ownerIdPromise === promise) ownerIdPromise = null; }
  );
  return promise;
}

async function initializeHistoryOwnerId() {
  if (!historySupabase?.auth) {
    console.warn('gameHistory: Supabase auth unavailable, skipping history operation');
    return null;
  }

  try {
    const { data: sessionData, error: sessionError } = await historySupabase.auth.getSession();
    if (sessionError) {
      console.warn('gameHistory: Failed to read anonymous auth session:', sessionError.message);
      return null;
    }

    const existingSession = sessionData?.session;
    const existingUser = existingSession?.user;
    if (existingUser?.id && existingUser.is_anonymous === true) return existingUser.id;

    // A non-anonymous session must never become the owner of this anonymous
    // history store. Sign out only the isolated history client, not multiplayer.
    if (existingSession) {
      const { error: signOutError } = await historySupabase.auth.signOut();
      if (signOutError) {
        console.warn('gameHistory: Failed to clear the history auth session:', signOutError.message);
        return null;
      }
    }

    const { data, error } = await historySupabase.auth.signInAnonymously();
    if (error || !data?.user?.id || data.user.is_anonymous !== true) {
      console.warn(
        'gameHistory: Anonymous sign-in unavailable. Enable Anonymous sign-ins in Supabase Auth.',
        error?.message || 'No anonymous user returned'
      );
      return null;
    }

    return data.user.id;
  } catch (err) {
    console.warn('gameHistory: Failed to initialize anonymous auth:', err.message);
    return null;
  }
}
