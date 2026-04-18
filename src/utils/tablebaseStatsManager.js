/**
 * Utility for managing tablebase query statistics in localStorage
 */

const STORAGE_KEY = 'chessweb_tablebase_stats';

/**
 * Get all tablebase statistics
 * @returns {Object} Statistics object
 */
export function getStats() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('[Stats] Error reading stats from localStorage:', e);
    return {};
  }
}

/**
 * Record a tablebase query
 * @param {string} fen - Chess position in FEN notation
 * @param {string} variant - Tablebase variant
 * @param {Object} tablebaseResult - Result from tablebase query
 */
export function recordQuery(fen, variant, tablebaseResult) {
  try {
    const stats = getStats();
    const key = `${variant}:${fen}`;

    if (!stats[key]) {
      stats[key] = {
        fen,
        variant,
        queries: 0,
        firstQueried: new Date().toISOString(),
        lastQueried: new Date().toISOString(),
        winsPercentage: 0,
        drawsPercentage: 0,
        lossesPercentage: 0,
      };
    }

    const stat = stats[key];
    stat.queries += 1;
    stat.lastQueried = new Date().toISOString();

    // Calculate WDL percentages from best move
    if (tablebaseResult.moves && tablebaseResult.moves.length > 0) {
      const bestMove = tablebaseResult.moves[0];
      const total =
        (bestMove.wdl.wins || 0) +
        (bestMove.wdl.draws || 0) +
        (bestMove.wdl.losses || 0);

      if (total > 0) {
        stat.winsPercentage = ((bestMove.wdl.wins || 0) / total) * 100;
        stat.drawsPercentage = ((bestMove.wdl.draws || 0) / total) * 100;
        stat.lossesPercentage = ((bestMove.wdl.losses || 0) / total) * 100;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('[Stats] Error recording query:', e);
  }
}

/**
 * Get popular endgames sorted by query count
 * @param {number} limit - Number of results to return
 * @returns {Array} Array of popular endgame stats
 */
export function getPopularEndgames(limit = 10) {
  try {
    const stats = getStats();
    return Object.values(stats)
      .sort((a, b) => b.queries - a.queries)
      .slice(0, limit);
  } catch (e) {
    console.error('[Stats] Error getting popular endgames:', e);
    return [];
  }
}

/**
 * Get statistics summary
 * @returns {Object} Summary statistics
 */
export function getSummary() {
  try {
    const stats = getStats();
    const entries = Object.values(stats);

    return {
      totalQueries: entries.reduce((sum, e) => sum + (e.queries || 0), 0),
      totalPositions: entries.length,
      averageWinRate: entries.length
        ? (entries.reduce((sum, e) => sum + (e.winsPercentage || 0), 0) /
            entries.length).toFixed(1)
        : 0,
      mostQueried: entries.length
        ? entries.sort((a, b) => b.queries - a.queries)[0]
        : null,
    };
  } catch (e) {
    console.error('[Stats] Error getting summary:', e);
    return {
      totalQueries: 0,
      totalPositions: 0,
      averageWinRate: 0,
      mostQueried: null,
    };
  }
}

/**
 * Clear all statistics
 */
export function clearStats() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[Stats] Error clearing stats:', e);
  }
}

/**
 * Export statistics as JSON
 * @returns {string} JSON string of statistics
 */
export function exportStats() {
  try {
    const stats = getStats();
    return JSON.stringify(stats, null, 2);
  } catch (e) {
    console.error('[Stats] Error exporting stats:', e);
    return '{}';
  }
}
