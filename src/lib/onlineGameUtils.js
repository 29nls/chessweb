/**
 * Shared utility functions for online multiplayer game management.
 * Extracted from useOnlineGame.js — also used by gameHistory.js.
 */

/**
 * Generate a random 6-character alphanumeric game code (uppercase).
 * Excludes confusing characters (0/O, 1/I).
 * @returns {string}
 */
export function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get or create a persistent anonymous player ID stored in localStorage.
 * The same ID is reused across sessions so game history is tied to a
 * consistent identity without requiring authentication.
 * @returns {string}
 */
export function getPlayerId() {
  try {
    let id = localStorage.getItem('chessweb_player_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('chessweb_player_id', id);
    }
    return id;
  } catch (err) {
    console.warn('onlineGameUtils: localStorage unavailable for player ID:', err);
    return 'player_' + Math.random().toString(36).substring(2, 10);
  }
}

/**
 * Persist active game state so the player can reconnect after a refresh.
 * @param {string} code - Game invite code
 * @param {string} color - Player color ('white' | 'black' | 'spectator')
 * @param {string} status - Game status ('waiting' | 'playing' | 'finished')
 */
export function saveGameState(code, color, status) {
  try {
    localStorage.setItem('chessweb_active_game', JSON.stringify({
      code, color, status, timestamp: Date.now(),
    }));
  } catch (err) {
    console.warn('onlineGameUtils: Failed to save game state:', err);
  }
}

/**
 * Remove persisted game state from localStorage (called on leave / cleanup).
 */
export function clearGameState() {
  try {
    localStorage.removeItem('chessweb_active_game');
  } catch (err) {
    console.warn('onlineGameUtils: Failed to clear game state:', err);
  }
}

/**
 * Retrieve saved game state, if it hasn't expired (30-minute TTL).
 * @returns {{ code: string, color: string, status: string } | null}
 */
export function getSavedGameState() {
  try {
    const raw = localStorage.getItem('chessweb_active_game');
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (Date.now() - state.timestamp > 30 * 60 * 1000) {
      clearGameState();
      return null;
    }
    return state;
  } catch (err) {
    console.warn('onlineGameUtils: Failed to read saved game state:', err);
    return null;
  }
}

// ─── Shared constants ───────────────────────────────────

export const TIME_CONTROL_PRESETS = [
  { label: '1 min', initialMs: 1 * 60 * 1000 },
  { label: '3 min', initialMs: 3 * 60 * 1000 },
  { label: '5 min', initialMs: 5 * 60 * 1000 },
  { label: '10 min', initialMs: 10 * 60 * 1000 },
  { label: '30 min', initialMs: 30 * 60 * 1000 },
  { label: 'Untimed', initialMs: 0 },
];
