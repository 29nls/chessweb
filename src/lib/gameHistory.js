import { historySupabase } from '../supabaseClient';
import { getPlayerId } from './onlineGameUtils';
import { getHistoryOwnerId } from './gameHistoryAuth';

function logHistoryError(action, error) {
  if (error?.code === '42P01') {
    console.warn('gameHistory: "games" table does not exist. Run the migration SQL in supabase/migrations/');
  } else {
    console.warn(`gameHistory: Error ${action}:`, error?.message || error);
  }
}

/** Save a completed game using a separate anonymous-auth ownership identity. */
export async function saveGame(gameData = {}) {
  if (!historySupabase) {
    console.warn('gameHistory: Supabase not configured, skipping save');
    return null;
  }

  const ownerId = await getHistoryOwnerId();
  if (!ownerId) return null;

  try {
    const { data, error } = await historySupabase
      .from('games')
      .insert({
        owner_id: ownerId,
        // Retained as multiplayer metadata; never used for authorization.
        player_id: getPlayerId(),
        player_white: gameData.playerWhite || 'White',
        player_black: gameData.playerBlack || 'Black',
        result: gameData.result || null,
        pgn: gameData.pgn || '',
        fen: gameData.fen || '',
        time_control_ms: gameData.timeControlMs || 0,
        source: gameData.source || 'analysis',
        game_code: gameData.gameCode || null,
        moves: gameData.moves || [],
        move_count: (gameData.moves || []).length,
      })
      .select('id')
      .single();

    if (error) {
      logHistoryError('saving game', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('gameHistory: Failed to save game:', err.message);
    return null;
  }
}

/**
 * Load games for the current history owner. Returns null when ownership auth
 * is unavailable, and an array for an available-but-empty/error result.
 */
export async function getGames(options = {}) {
  if (!historySupabase) {
    console.warn('gameHistory: Supabase not configured');
    return null;
  }

  const ownerId = await getHistoryOwnerId();
  if (!ownerId) return null;

  const { limit = 50, offset = 0, source } = options;
  try {
    let query = historySupabase
      .from('games')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (source) query = query.eq('source', source);

    const { data, error } = await query;
    if (error) {
      logHistoryError('loading games', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('gameHistory: Failed to load games:', err.message);
    return [];
  }
}

/** Get a single game by ID, restricted to the current history owner. */
export async function getGameById(id) {
  if (!historySupabase) return null;
  const ownerId = await getHistoryOwnerId();
  if (!ownerId) return null;

  try {
    const { data, error } = await historySupabase
      .from('games')
      .select('*')
      .eq('id', id)
      .eq('owner_id', ownerId)
      .single();
    if (error) {
      logHistoryError('loading game', error);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('gameHistory: Failed to load game:', err.message);
    return null;
  }
}

/** Delete a game by ID; RLS authorizes the operation using auth.uid(). */
export async function deleteGame(id) {
  if (!historySupabase) return false;
  const ownerId = await getHistoryOwnerId();
  if (!ownerId) return false;

  try {
    const { data, error } = await historySupabase
      .from('games')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId)
      .select('id');
    if (error) {
      logHistoryError('deleting game', error);
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.warn('gameHistory: Failed to delete game:', err.message);
    return false;
  }
}

/** Get total game count for the current history owner. */
export async function getGameCount() {
  if (!historySupabase) return 0;
  const ownerId = await getHistoryOwnerId();
  if (!ownerId) return 0;

  try {
    const { count, error } = await historySupabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', ownerId);
    if (error) {
      logHistoryError('counting games', error);
      return 0;
    }
    return count || 0;
  } catch (err) {
    console.warn('gameHistory: Failed to get game count:', err);
    return 0;
  }
}
