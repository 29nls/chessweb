/**
 * Tablebase Utilities - Advanced tablebase operations
 * Aligned with Lichess tablebase API specification
 */

const tablebaseModule = require('./lichessTablebase');

/**
 * Position categories based on Lichess classification
 */
const POSITION_CATEGORIES = {
  WIN: 'win',
  SYZYGY_WIN: 'syzygy-win',
  CURSED_WIN: 'cursed-win',
  BLESSED_LOSS: 'blessed-loss',
  DRAW: 'draw',
  MAYBE_LOSS: 'maybe-loss',
  SYZYGY_LOSS: 'syzygy-loss',
  LOSS: 'loss',
  UNKNOWN: 'unknown',
  MAYBE_WIN: 'maybe-win',
};

/**
 * Get best move from tablebase position
 * @param {Object} tablebaseResult - Result from queryTablebase
 * @returns {Object|null} Best move or null
 */
function getBestMove(tablebaseResult) {
  if (!tablebaseResult.moves || tablebaseResult.moves.length === 0) {
    return null;
  }
  return tablebaseResult.moves[0];
}

/**
 * Analyze position outcome
 * @param {Object} tablebaseResult - Tablebase analysis result
 * @returns {Object} Position analysis
 */
function analyzePosition(tablebaseResult) {
  const {
    checkmate,
    stalemate,
    insufficient_material,
    category,
    variant_win,
    variant_loss,
    moves,
  } = tablebaseResult;

  return {
    isCheckmate: checkmate,
    isStalemate: stalemate,
    isInsufficientMaterial: insufficient_material,
    category: category,
    isVariantWin: variant_win,
    isVariantLoss: variant_loss,
    hasLegalMoves: (moves && moves.length > 0),
    isDrawn: category === POSITION_CATEGORIES.DRAW || stalemate || insufficient_material,
    isWinning: [
      POSITION_CATEGORIES.WIN,
      POSITION_CATEGORIES.SYZYGY_WIN,
      POSITION_CATEGORIES.CURSED_WIN,
    ].includes(category),
    isLosing: [
      POSITION_CATEGORIES.LOSS,
      POSITION_CATEGORIES.SYZYGY_LOSS,
      POSITION_CATEGORIES.MAYBE_LOSS,
      POSITION_CATEGORIES.BLESSED_LOSS,
    ].includes(category),
  };
}

/**
 * Calculate WDL statistics for moves
 * @param {Array} moves - Moves array from tablebase
 * @returns {Object} WDL statistics
 */
function calculateWDLStats(moves) {
  if (!moves || moves.length === 0) {
    return { totalWins: 0, totalDraws: 0, totalLosses: 0 };
  }

  let totalWins = 0;
  let totalDraws = 0;
  let totalLosses = 0;

  moves.forEach((move) => {
    if (move.wdl) {
      totalWins += move.wdl.wins || 0;
      totalDraws += move.wdl.draws || 0;
      totalLosses += move.wdl.losses || 0;
    }
  });

  const total = totalWins + totalDraws + totalLosses;
  return {
    totalWins,
    totalDraws,
    totalLosses,
    total,
    winRate: total > 0 ? ((totalWins / total) * 100).toFixed(1) : 0,
    drawRate: total > 0 ? ((totalDraws / total) * 100).toFixed(1) : 0,
    lossRate: total > 0 ? ((totalLosses / total) * 100).toFixed(1) : 0,
  };
}

/**
 * Compare moves by strength
 * @param {Array} moves - Moves to compare
 * @param {string} criterion - 'dtz', 'dtm', or 'wdl'
 * @returns {Array} Sorted moves
 */
function compareMoves(moves, criterion = 'dtz') {
  if (!moves || moves.length === 0) return [];

  const sorted = [...moves];

  if (criterion === 'dtz') {
    sorted.sort((a, b) => (a.dtz || Infinity) - (b.dtz || Infinity));
  } else if (criterion === 'dtm') {
    sorted.sort((a, b) => {
      const aDtm = a.dtm || Infinity;
      const bDtm = b.dtm || Infinity;
      return Math.abs(aDtm) - Math.abs(bDtm);
    });
  } else if (criterion === 'wdl') {
    sorted.sort((a, b) => {
      const aWins = a.wdl?.wins || 0;
      const bWins = b.wdl?.wins || 0;
      return bWins - aWins; // Descending
    });
  }

  return sorted;
}

/**
 * Generate move recommendations
 * @param {Object} tablebaseResult - Tablebase result
 * @returns {Array} Recommended moves with reasoning
 */
function getRecommendations(tablebaseResult) {
  const { moves, category, checkmate, stalemate } = tablebaseResult;

  if (checkmate) {
    return [{ type: 'info', text: 'Checkmate' }];
  }

  if (stalemate) {
    return [{ type: 'info', text: 'Stalemate' }];
  }

  if (!moves || moves.length === 0) {
    return [{ type: 'unknown', text: 'No legal moves available' }];
  }

  const recommendations = [];

  // Checkmate recommendations
  const checkmateMoves = moves.filter((m) => m.checkmate);
  if (checkmateMoves.length > 0) {
    recommendations.push({
      type: 'checkmate',
      text: `Checkmate in ${Math.abs(checkmateMoves[0].dtm) / 2} moves`,
      moves: checkmateMoves,
    });
  }

  // Winning moves
  const winningMoves = moves.filter((m) => {
    const moveCategory = m.category;
    return [
      POSITION_CATEGORIES.WIN,
      POSITION_CATEGORIES.SYZYGY_WIN,
    ].includes(moveCategory);
  });

  if (winningMoves.length > 0 && !checkmateMoves.length) {
    const bestWin = winningMoves.sort((a, b) => (a.dtz || Infinity) - (b.dtz || Infinity))[0];
    recommendations.push({
      type: 'winning',
      text: `Winning move: ${bestWin.san}`,
      dtz: bestWin.dtz,
      moves: winningMoves.slice(0, 3),
    });
  }

  // Draw options
  const drawMoves = moves.filter((m) => m.category === POSITION_CATEGORIES.DRAW);
  if (drawMoves.length > 0) {
    recommendations.push({
      type: 'draw',
      text: `${drawMoves.length} move(s) lead to draw`,
      moves: drawMoves.slice(0, 3),
    });
  }

  // Avoid losing moves
  const losingMoves = moves.filter((m) => {
    const moveCategory = m.category;
    return [POSITION_CATEGORIES.LOSS, POSITION_CATEGORIES.SYZYGY_LOSS].includes(moveCategory);
  });

  if (losingMoves.length > 0) {
    recommendations.push({
      type: 'warning',
      text: `Avoid: ${losingMoves.length} move(s) lose`,
      moves: losingMoves,
    });
  }

  return recommendations;
}

/**
 * Get position evaluation shorthand
 * @param {Object} tablebaseResult - Tablebase result
 * @returns {string} Evaluation shorthand (e.g., '+3', '-2', '=')
 */
function getEvaluation(tablebaseResult) {
  const { category, dtm, dtz } = tablebaseResult;

  if (category === POSITION_CATEGORIES.CHECKMATE) {
    return dtm !== null ? `#${Math.abs(dtm) / 2}` : '#';
  }

  if (category === POSITION_CATEGORIES.DRAW) {
    return '=';
  }

  if (
    [POSITION_CATEGORIES.WIN, POSITION_CATEGORIES.SYZYGY_WIN].includes(category)
  ) {
    return '+' + (dtz !== null ? dtz : '∞');
  }

  if (
    [POSITION_CATEGORIES.LOSS, POSITION_CATEGORIES.SYZYGY_LOSS].includes(
      category
    )
  ) {
    return '-' + (dtz !== null ? dtz : '∞');
  }

  return '?';
}

module.exports = {
  analyzePosition,
  getBestMove,
  calculateWDLStats,
  compareMoves,
  getRecommendations,
  getEvaluation,
  POSITION_CATEGORIES,
};
