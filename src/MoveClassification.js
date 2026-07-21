/**
 * Move Classification Utility
 * Classifies chess moves based on centipawn loss (engine evaluation change)
 * 
 * Thresholds inspired by chess.com/lichess:
 *   loss = evaluation change from player's perspective (positive = position got worse)
 */

export const LABELS = {
  // Chess notation conventions:
  // ′′ brilliant, ★ engine-best, ! good, ± interesting advantage
  // ?! dubious/inaccuracy, ? mistake, ?? blunder
  BRILLIANT: { label: 'Brilliant', icon: '‼',  color: '#4FC3F7' },
  BEST:      { label: 'Best',      icon: '★',  color: '#43A047' },
  GREAT:     { label: 'Great',     icon: '!',   color: '#66BB6A' },
  EXCELLENT: { label: 'Excellent', icon: '✓',  color: '#81C784' },
  GOOD:      { label: 'Good',      icon: '',    color: '#9E9E9E' },
  INACCURACY:{ label: 'Inaccuracy',icon: '?!',  color: '#FFA726' },
  MISS:      { label: 'Miss',      icon: '?!?', color: '#FF7043' },
  MISTAKE:   { label: 'Mistake',   icon: '?',   color: '#EF5350' },
  BLUNDER:   { label: 'Blunder',   icon: '??',  color: '#E53935' },
};

// PGN NAG (Numeric Annotation Glyph) mapping for PGN export
// $1=!, $2=?, $3=!!, $4=??, $5=!?, $6=?!
export const CLASS_TO_NAG = {
  BRILLIANT: '$3',
  BEST: '$1',
  GREAT: '$1',
  EXCELLENT: '$1',
  GOOD: '',
  INACCURACY: '$6',
  MISS: '$2',
  MISTAKE: '$2',
  BLUNDER: '$4',
};

/**
 * Build a PGN string with NAG annotations from moves and classifications
 * @param {Object} headers - PGN headers object
 * @param {string[]} movesArray - Array of move SAN strings
 * @param {Object[]} classifications - Array of classification objects per move
 * @returns {string} Complete PGN string with NAG annotations
 */
function getNagForClassification(cls) {
  if (!cls) return '';
  const key = getLabelKey(cls);
  return key ? (CLASS_TO_NAG[key] || '') : '';
}

export function buildPgnWithNag(headers, movesArray, classifications) {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `[${k} "${v}"]`)
    .join('\n');

  if (!movesArray || movesArray.length === 0) return `${headerLines}\n\n`;

  const moveLines = [];
  for (let i = 0; i < movesArray.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const whiteMove = movesArray[i];
    const whiteNag = getNagForClassification(classifications?.[i]);
    const blackMove = movesArray[i + 1];
    const blackNag = blackMove ? getNagForClassification(classifications?.[i + 1]) : '';

    let line = `${moveNum}. ${whiteMove}`;
    if (whiteNag) line += ` ${whiteNag}`;
    if (blackMove) {
      line += ` ${blackMove}`;
      if (blackNag) line += ` ${blackNag}`;
    }
    moveLines.push(line);
  }

  return `${headerLines}\n\n${moveLines.join(' ')}`;
}

/**
 * Compute accuracy score (0-100) from centipawn loss
 * loss <= 0 → 100 (perfect), loss >= 300 → 0 (blunder threshold)
 */
export function lossToAccuracy(loss) {
  if (loss <= 0) return 100;
  if (loss >= 300) return 0;
  return Math.round(100 - (loss / 300) * 100);
}

/**
 * Compute per-side accuracy report from move classifications
 * @param {Object[]} classifications - Array per move: { label, icon, color, loss? }
 * @param {string[]} moves - Array of SAN strings
 * @returns {{ white: { accuracy: number, counts: Object, moves: number }, black: ... }}
 */
// Classification-label-to-accuracy mapping (since loss isn't stored on classification objects)
const LABEL_ACCURACY = {
  'Brilliant': 100,
  'Best': 100,
  'Great': 90,
  'Excellent': 80,
  'Good': 70,
  'Inaccuracy': 40,
  'Miss': 30,
  'Mistake': 20,
  'Blunder': 0,
};

export function computeAccuracyReport(classifications, moves) {
  const report = {
    white: { accuracy: 0, counts: {}, moves: 0 },
    black: { accuracy: 0, counts: {}, moves: 0 },
  };

  classifications.forEach((cls, i) => {
    if (!cls || i >= moves.length) return;
    const side = i % 2 === 0 ? 'white' : 'black';
    report[side].moves++;

    const labelKey = cls.label || cls;
    report[side].counts[labelKey] = (report[side].counts[labelKey] || 0) + 1;

    // Use label-based accuracy since classification objects don't store loss
    report[side].accuracy += LABEL_ACCURACY[labelKey] ?? 100;
  });

  ['white', 'black'].forEach(side => {
    if (report[side].moves > 0) {
      report[side].accuracy = Math.round(report[side].accuracy / report[side].moves);
    }
  });

  return report;
}

/**
 * Get the classification label key from a classification object
 */
export function getLabelKey(cls) {
  if (!cls) return null;
  return Object.entries(LABELS).find(([, v]) => v.label === cls.label)?.[0] || null;
}

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
