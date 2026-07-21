/**
 * Move Classification Utility
 * Classifies chess moves based on centipawn loss (engine evaluation change)
 * 
 * Thresholds inspired by chess.com/lichess:
 *   loss = evaluation change from player's perspective (positive = position got worse)
 */

export const LABELS = {
  BRILLIANT: { label: 'Brilliant', icon: '++', color: '#4FC3F7' },  // Berubah dari '??' (dulu clash dengan BLUNDER)
  GREAT:     { label: 'Great',     icon: '!?', color: '#66BB6A' },
  BEST:      { label: 'Best',      icon: '!!', color: '#43A047' },
  EXCELLENT: { label: 'Excellent', icon: '!',  color: '#81C784' },
  GOOD:      { label: 'Good',      icon: '',   color: '#9E9E9E' },
  INACCURACY:{ label: 'Inaccuracy',icon: '?!', color: '#FFA726' }, // Berubah dari '?' (dulu clash dengan MISTAKE)
  MISS:      { label: 'Miss',      icon: '!?', color: '#FF7043' }, // Berubah dari '?!' (swap dengan INACCURACY)
  MISTAKE:   { label: 'Mistake',   icon: '?',  color: '#EF5350' },
  BLUNDER:   { label: 'Blunder',   icon: '??', color: '#E53935' },
};

/**
 * Classify a move based on centipawn loss and context
 * @param {number} loss - Centipawn loss from player's perspective (positive = worse)
 * @param {number} beforeEval - Evaluation before the move
 * @param {number} afterEval - Evaluation after the move
 * @param {boolean} isEngineMove - Whether this move was played by Stockfish
 * @returns {{ label: string, icon: string, color: string }}
 */
export function classifyMove(loss, beforeEval, afterEval, isEngineMove = false) {
  // Engine moves are always at least "Best"
  if (isEngineMove) return LABELS.BEST;

  // Player gained significant advantage (better than engine expected)
  if (loss <= -300) return LABELS.BRILLIANT;
  if (loss <= -150) return LABELS.GREAT;
  if (loss <= -50)  return LABELS.EXCELLENT;
  if (loss < 0)     return LABELS.GOOD;

  // Player lost advantage
  if (loss >= 300) return LABELS.BLUNDER;
  if (loss >= 150) return LABELS.MISTAKE;
  
  // "Miss" detection: position was winning (≥ 2 pawns) but after move it's not
  const beforeAdvantage = Math.abs(beforeEval);
  const afterAdvantage = Math.abs(afterEval);
  if (loss >= 75 && beforeAdvantage >= 200 && afterAdvantage < 100) {
    return LABELS.MISS;
  }
  
  if (loss >= 75) return LABELS.INACCURACY;
  if (loss > 0)   return LABELS.GOOD;

  return LABELS.EXCELLENT;
}

/**
 * Calculate centipawn loss from the player's perspective
 * @param {number} beforeEval - Eval before move (White's perspective)
 * @param {number} afterEval - Eval after move (White's perspective)
 * @param {string} sideThatMoved - 'w' or 'b'
 * @returns {number} Positive = player's position got worse
 */
export function calculateLoss(beforeEval, afterEval, sideThatMoved) {
  if (sideThatMoved === 'w') {
    return beforeEval - afterEval;
  } else {
    return afterEval - beforeEval;
  }
}
