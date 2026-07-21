import { supabase } from '../supabaseClient';

/**
 * Get the anonymous player ID from localStorage.
 */
function getPlayerId() {
  try {
    let id = localStorage.getItem('chessweb_player_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('chessweb_player_id', id);
    }
    return id;
  } catch {
    return 'player_' + Math.random().toString(36).substring(2, 10);
  }
}

/**
 * Save a completed game to the database.
 * Degrades gracefully if Supabase is not configured or table doesn't exist.
 *
 * @param {object} gameData
 * @param {string} gameData.pgn - Full PGN string
 * @param {object} [gameData.result] - { winner, reason }
 * @param {string[]} [gameData.moves] - Array of SAN moves
 * @param {string} [gameData.fen] - Final position FEN
 * @param {string} [gameData.source] - 'online' | 'analysis'
 * @param {string} [gameData.gameCode] - Online game invite code
 * @param {string} [gameData.playerWhite] - White player name
 * @param {string} [gameData.playerBlack] - Black player name
 * @param {number} [gameData.timeControlMs] - Time control in ms
 * @returns {Promise<{ id: number }|null>} Saved game ID or null on failure
 */
export async function saveGame(gameData) {
  if (!supabase) {
    console.warn('gameHistory: Supabase not configured, skipping save');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('games')
      .insert({
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
      // Table might not exist yet — warn but don't crash
      if (error.code === '42P01') {
        console.warn('gameHistory: "games" table does not exist. Run the migration SQL in supabase/migrations/');
      } else {
        console.warn('gameHistory: Error saving game:', error.message);
      }
      return null;
    }

    return data;
  } catch (err) {
    console.warn('gameHistory: Failed to save game:', err.message);
    return null;
  }
}

/**
 * Load games for the current player, sorted by most recent first.
 *
 * @param {object} [options]
 * @param {number} [options.limit=50] - Max games to fetch
 * @param {number} [options.offset=0] - Pagination offset
 * @param {string} [options.source] - Optional source filter ('online'|'analysis')
 * @returns {Promise<Array>} Array of game objects
 */
export async function getGames(options = {}) {
  if (!supabase) {
    console.warn('gameHistory: Supabase not configured');
    return [];
  }

  const { limit = 50, offset = 0, source } = options;

  try {
    let query = supabase
      .from('games')
      .select('*')
      .eq('player_id', getPlayerId())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (source) {
      query = query.eq('source', source);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        console.warn('gameHistory: "games" table does not exist. Run the migration SQL.');
      } else {
        console.warn('gameHistory: Error loading games:', error.message);
      }
      return [];
    }

    return data || [];
  } catch (err) {
    console.warn('gameHistory: Failed to load games:', err.message);
    return [];
  }
}

/**
 * Get a single game by ID.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
export async function getGameById(id) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.warn('gameHistory: Error loading game:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.warn('gameHistory: Failed to load game:', err.message);
    return null;
  }
}

/**
 * Delete a game by ID.
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function deleteGame(id) {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', id)
      .eq('player_id', getPlayerId()); // Only delete own games

    if (error) {
      console.warn('gameHistory: Error deleting game:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('gameHistory: Failed to delete game:', err.message);
    return false;
  }
}

/**
 * Get total game count for the current player.
 * @returns {Promise<number>}
 */
export async function getGameCount() {
  if (!supabase) return 0;

  try {
    const { count, error } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', getPlayerId());

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}
