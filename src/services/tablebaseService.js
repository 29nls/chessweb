/**
 * Tablebase Service - Client-side tablebase query handler
 * Communicates with backend or directly queries Lichess API
 * Uses local caching for offline support
 */

import { 
  getCachedResult, 
  cacheResult, 
  getCacheStats,
  clearLocalCache 
} from './localTablebaseCache';

const API_BASE = 'http://localhost:3001/api';

/**
 * Query tablebase - checks cache first, then API
 * @param {string} fen - Chess position in FEN
 * @param {string} variant - Variant type (standard, atomic, antichess)
 * @param {boolean} useCache - Use local cache
 * @returns {Promise<Object>} Tablebase analysis
 */
export async function queryTablebase(fen, variant = 'standard', useCache = true) {
  // Check local cache first
  if (useCache) {
    const cached = getCachedResult(fen, variant);
    if (cached) {
      console.log('[TablebaseService] Using cached result');
      return cached;
    }
  }

  try {
    // Query backend API
    const response = await fetch(`${API_BASE}/tablebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, variant }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // Cache successful results
    if (result && !result.error && useCache) {
      cacheResult(fen, variant, result);
    }

    return result;
  } catch (error) {
    console.error('[TablebaseService] Query error:', error);
    return {
      fen,
      variant,
      error: error.message,
      moves: [],
      mainline: [],
    };
  }
}

/**
 * Query tablebase mainline only (faster)
 * @param {string} fen - Chess position
 * @param {string} variant - Variant type
 * @param {boolean} useCache - Use local cache
 * @returns {Promise<Object>} Mainline analysis
 */
export async function queryTablebaseMainline(
  fen,
  variant = 'standard',
  useCache = true
) {
  if (useCache) {
    const cached = getCachedResult(fen, variant);
    if (cached && cached.mainline) {
      return {
        fen,
        variant,
        mainline: cached.mainline,
        dtz: cached.dtz,
      };
    }
  }

  try {
    const response = await fetch(`${API_BASE}/tablebase/mainline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen, variant }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[TablebaseService] Mainline query error:', error);
    return {
      fen,
      variant,
      error: error.message,
      mainline: [],
    };
  }
}

/**
 * Get cache statistics from backend
 * @returns {Promise<Object>} Cache stats
 */
export async function getCacheStatsFromBackend() {
  try {
    const response = await fetch(`${API_BASE}/tablebase/cache/stats`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[TablebaseService] Failed to get cache stats:', error);
    return null;
  }
}

/**
 * Clear backend cache
 * @returns {Promise<Object>} Result
 */
export async function clearBackendCache() {
  try {
    const response = await fetch(`${API_BASE}/tablebase/cache/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[TablebaseService] Failed to clear cache:', error);
    return { error: error.message };
  }
}

/**
 * Get local cache statistics
 * @returns {Object} Local cache stats
 */
export function getLocalCacheStats() {
  return getCacheStats();
}

/**
 * Clear local cache
 */
export function clearLocalCacheData() {
  clearLocalCache();
}

/**
 * Check if position is likely in tablebase (≤7 pieces)
 * @param {string} fen - Position in FEN
 * @returns {boolean} True if endgame position
 */
export function isEndgamePosition(fen) {
  try {
    const piecesMatch = fen.split(' ')[0].match(/[a-zA-Z]/g);
    const piecesCount = piecesMatch ? piecesMatch.length : 0;
    return piecesCount <= 7;
  } catch (e) {
    return false;
  }
}

/**
 * Get human-readable position evaluation
 * @param {Object} tablebaseResult - Tablebase result
 * @returns {string} Evaluation text
 */
export function getPositionEvaluation(tablebaseResult) {
  const { category, dtm, dtz, checkmate, stalemate } = tablebaseResult;

  if (checkmate) return 'Checkmate';
  if (stalemate) return 'Stalemate';

  if (category === 'win' || category === 'syzygy-win') {
    return `Winning${dtz !== null ? ` (+${dtz})` : ''}`;
  }

  if (category === 'loss' || category === 'syzygy-loss') {
    return `Losing${dtz !== null ? ` (-${dtz})` : ''}`;
  }

  if (category === 'draw') return 'Draw';
  if (category === 'cursed-win') return 'Cursed Win';
  if (category === 'blessed-loss') return 'Blessed Loss';

  return 'Unknown';
}

/**
 * Get best move UCI from tablebase
 * @param {Object} tablebaseResult - Tablebase result
 * @returns {string|null} Best move UCI or null
 */
export function getBestMoveUCI(tablebaseResult) {
  if (!tablebaseResult.moves || tablebaseResult.moves.length === 0) {
    return null;
  }
  return tablebaseResult.moves[0].uci;
}

/**
 * Get best move SAN from tablebase
 * @param {Object} tablebaseResult - Tablebase result
 * @returns {string|null} Best move SAN or null
 */
export function getBestMoveSAN(tablebaseResult) {
  if (!tablebaseResult.moves || tablebaseResult.moves.length === 0) {
    return null;
  }
  return tablebaseResult.moves[0].san;
}

/**
 * Calculate WDL percentages from best move
 * @param {Object} tablebaseResult - Tablebase result
 * @returns {Object} WDL percentages
 */
export function getWDLPercentages(tablebaseResult) {
  if (!tablebaseResult.moves || tablebaseResult.moves.length === 0) {
    return { wins: 0, draws: 0, losses: 0 };
  }

  const bestMove = tablebaseResult.moves[0];
  if (!bestMove.wdl) {
    return { wins: 0, draws: 0, losses: 0 };
  }

  const total = (bestMove.wdl.wins || 0) + (bestMove.wdl.draws || 0) + (bestMove.wdl.losses || 0);

  if (total === 0) {
    return { wins: 0, draws: 0, losses: 0 };
  }

  return {
    wins: ((bestMove.wdl.wins || 0) / total * 100).toFixed(1),
    draws: ((bestMove.wdl.draws || 0) / total * 100).toFixed(1),
    losses: ((bestMove.wdl.losses || 0) / total * 100).toFixed(1),
  };
}

/**
 * Get top N moves from tablebase
 * @param {Object} tablebaseResult - Tablebase result
 * @param {number} n - Number of moves to return
 * @returns {Array} Top N moves
 */
export function getTopMoves(tablebaseResult, n = 3) {
  if (!tablebaseResult.moves) return [];
  return tablebaseResult.moves.slice(0, n);
}

/**
 * Filter winning moves
 * @param {Object} tablebaseResult - Tablebase result
 * @returns {Array} Winning moves
 */
export function getWinningMoves(tablebaseResult) {
  if (!tablebaseResult.moves) return [];
  return tablebaseResult.moves.filter((m) =>
    ['win', 'syzygy-win', 'cursed-win'].includes(m.category)
  );
}

/**
 * Filter drawing moves
 * @param {Object} tablebaseResult - Tablebase result
 * @returns {Array} Drawing moves
 */
export function getDrawingMoves(tablebaseResult) {
  if (!tablebaseResult.moves) return [];
  return tablebaseResult.moves.filter((m) => m.category === 'draw');
}

/**
 * Filter losing moves (to avoid)
 * @param {Object} tablebaseResult - Tablebase result
 * @returns {Array} Losing moves
 */
export function getLosingMoves(tablebaseResult) {
  if (!tablebaseResult.moves) return [];
  return tablebaseResult.moves.filter((m) =>
    ['loss', 'syzygy-loss', 'blessed-loss'].includes(m.category)
  );
}

/**
 * Validate FEN format
 * @param {string} fen - FEN to validate
 * @returns {boolean} True if valid FEN
 */
export function isValidFEN(fen) {
  if (!fen || typeof fen !== 'string') return false;
  const parts = fen.split(' ');
  // FEN should have 6 parts
  return parts.length === 6;
}

/**
 * Normalize FEN (replace underscores with spaces)
 * @param {string} fen - FEN with underscores
 * @returns {string} FEN with spaces
 */
export function normalizeFEN(fen) {
  return fen ? fen.replace(/_/g, ' ') : '';
}
