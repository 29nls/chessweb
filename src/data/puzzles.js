/**
 * Chess puzzle database.
 *
 * Each puzzle has:
 *  - id: unique numeric ID
 *  - fen: starting position FEN
 *  - moves: solution moves in SAN (alternating player/opponent)
 *  - rating: difficulty rating (estimated)
 *  - themes: array of tactic themes
 *  - description: short hint
 */

const puzzles = [
  // ─── Fork / Double Attack ───
  {
    id: 1,
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    moves: ['Nd4', 'Nxd4', 'Bb5'],
    rating: 1200,
    themes: ['Fork', 'Center'],
    description: 'White to play — exploit the loose knight on c6.',
  },
  {
    id: 2,
    fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 5',
    moves: ['Nxe4', 'dxe4', 'Bxf2+'],
    rating: 1400,
    themes: ['Fork', 'Sacrifice'],
    description: 'Black to play — a classic fork on f2.',
  },

  // ─── Sacrifice / Mating Attack ───
  {
    id: 3,
    fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 5',
    moves: ['Qxg7', 'Rg8', 'Qxf8+'],
    rating: 1100,
    themes: ['Sacrifice', 'Mating Attack'],
    description: 'White to play — a queen sacrifice to force checkmate.',
  },
  {
    id: 4,
    fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 6',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
    rating: 1500,
    themes: ['Sacrifice', 'Greek Gift'],
    description: 'White to play — the classic Greek Gift sacrifice.',
  },

  // ─── Pin / Skewer ───
  {
    id: 5,
    fen: 'r1bq1rk1/ppp2ppp/2np4/2b1p3/2B1P1n1/2NP1NPp/PPP2P1P/R1BQK2R w KQ - 0 8',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
    rating: 1600,
    themes: ['Pin', 'Sacrifice'],
    description: 'White to play — exploit the pinned knight.',
  },
  {
    id: 6,
    fen: '2kr3r/ppp2ppp/2n5/3q4/3P4/6P1/PP3P1P/R2Q1RK1 b - - 0 14',
    moves: ['Qxd4', 'g4', 'Qxd1', 'Rfxd1', 'Rxd1+'],
    rating: 1700,
    themes: ['Skewer', 'Queen Trap'],
    description: 'Black to play — win material with a skewer.',
  },

  // ─── Discovered Attack ───
  {
    id: 7,
    fen: 'r2qk2r/ppp2ppp/2np4/2b1p1B1/2BnP3/3P1N2/PPP2PPP/RN1QK2R w KQkq - 0 7',
    moves: ['Bxf7+', 'Kd7', 'Nxe5+'],
    rating: 1300,
    themes: ['Discovered Attack', 'Fork'],
    description: 'White to play — discover an attack on the queen.',
  },
  {
    id: 8,
    fen: 'r1bq1rk1/ppp2ppp/2np4/4p3/2BnP1n1/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
    rating: 1500,
    themes: ['Discovered Attack', 'Sacrifice'],
    description: 'White to play — clear the way for a winning discovery.',
  },

  // ─── Back Rank Mate ───
  {
    id: 9,
    fen: '6k1/5ppp/7r/8/8/1Q6/5PPP/3R2K1 b - - 0 1',
    moves: ['Rd6', 'Qb8+', 'Rd8'],
    rating: 1400,
    themes: ['Back Rank', 'Mate Threat'],
    description: 'Black to play — threaten mate on the back rank.',
  },

  // ─── Deflection / Removal of Defender ───
  {
    id: 10,
    fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 6',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
    rating: 1600,
    themes: ['Deflection', 'Sacrifice'],
    description: 'White to play — deflect the defender of the queen.',
  },

  // ─── Interference ───
  {
    id: 11,
    fen: 'r2q1rk1/ppp2ppp/2np4/4p3/2BnP1n1/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
    rating: 1700,
    themes: ['Interference', 'Mate'],
    description: 'White to play — cut off the defender.',
  },

  // ─── Pawn Promotion ───
  {
    id: 12,
    fen: '8/4k3/3p4/3P4/3K4/8/8/8 w - - 0 1',
    moves: ['Ke4', 'Kd8', 'Kf5', 'Ke8', 'Ke6', 'Kf8', 'Kxd6', 'Kg8', 'Kc7', 'Kh8', 'd6', 'Kh7', 'd7', 'Kg8', 'd8=Q'],
    rating: 1800,
    themes: ['Pawn Endgame', 'Promotion'],
    description: 'White to play — can you promote the pawn?',
  },
  {
    id: 13,
    fen: '8/8/3k4/4K3/8/6P1/8/8 w - - 0 1',
    moves: ['Kf6', 'Kd5', 'Kg6', 'Ke5', 'Kh6', 'Kf5', 'g4', 'Ke5', 'g5', 'Kf5', 'g6', 'Ke5', 'g7', 'Kf5', 'g8=Q'],
    rating: 2000,
    themes: ['Pawn Endgame', 'King Opposition'],
    description: 'White to play — use king opposition to promote.',
  },

  // ─── Smothered Mate ───
  {
    id: 14,
    fen: '6k1/5ppp/8/3P4/8/6N1/5PPP/6K1 w - - 0 1',
    moves: ['Nf5', 'Kf8', 'Nh6', 'gxh6', 'd6'],
    rating: 1500,
    themes: ['Smothered Mate', 'Knight'],
    description: 'White to play — set up a smothered mate pattern.',
  },

  // ═══════════════════════════════════════════════════════════
  // ZUGZWANG PUZZLES
  // ═══════════════════════════════════════════════════════════

  {
    id: 15,
    fen: 'k7/8/1K6/4P3/8/8/8/8 w - - 0 1',
    moves: ['e6', 'Kb8', 'e7', 'Kc8', 'e8=Q'],
    rating: 1900,
    themes: ['Zugzwang', 'Pawn Endgame', 'Promotion'],
    description: 'White to play — force Black into zugzwang and promote with mate.',
  },
  {
    id: 16,
    fen: '8/3k4/8/3KP3/8/8/8/8 w - - 0 1',
    moves: ['e6+', 'Kc8', 'e7', 'Kd7', 'e8=Q'],
    rating: 1800,
    themes: ['Zugzwang', 'Pawn Endgame', 'Promotion'],
    description: 'White to play — outflank Black and promote the pawn.',
  },

  // ═══════════════════════════════════════════════════════════
  // ZWISCHENZUG PUZZLES
  // ═══════════════════════════════════════════════════════════

  {
    id: 17,
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    moves: ['Ng5', 'Nxe4', 'Nxf7'],
    rating: 1200,
    themes: ['Zwischenzug', 'Fork', 'Trap'],
    description: 'White to play — a zwischenzug! Fork the queen and rook instead of retreating.',
  },

  // ═══════════════════════════════════════════════════════════
  // ENDGAME PUZZLES
  // ═══════════════════════════════════════════════════════════

  {
    id: 18,
    fen: '8/3k4/8/3K1P2/8/8/8/8 w - - 0 1',
    moves: ['Ke4', 'Kc7', 'f6', 'Kb8', 'f7', 'Kc8', 'f8=Q'],
    rating: 1800,
    themes: ['Endgame', 'Pawn Promotion', 'King Opposition'],
    description: 'White to play — use king opposition to promote the pawn.',
  },
  {
    id: 19,
    fen: '8/8/1k6/p7/P2K4/8/8/8 w - - 0 1',
    moves: ['Kc4', 'Ka7', 'Kb5', 'Ka8', 'Kxa5'],
    rating: 2000,
    themes: ['Endgame', 'Pawn Race', 'King Maneuver'],
    description: 'White to play — march the king to capture Black\'s pawn before it promotes.',
  },
];

export default puzzles;

/**
 * Get a subset of puzzles filtered by criteria.
 * @param {object} filters
 * @param {string} [filters.theme] - Filter by theme name
 * @param {number} [filters.maxRating] - Max rating
 * @param {number} [filters.minRating] - Min rating
 * @returns {Array} Filtered puzzle array
 */
export function getPuzzles(filters = {}) {
  let result = [...puzzles];
  if (filters.theme) {
    result = result.filter(p => p.themes.some(t => t.toLowerCase() === filters.theme.toLowerCase()));
  }
  if (filters.maxRating != null) {
    result = result.filter(p => p.rating <= filters.maxRating);
  }
  if (filters.minRating != null) {
    result = result.filter(p => p.rating >= filters.minRating);
  }
  return result;
}

/**
 * Get a random puzzle, optionally filtered.
 * @param {object} [filters] - Same as getPuzzles filters
 * @returns {object} A random puzzle object
 */
export function getRandomPuzzle(filters = {}) {
  const filtered = getPuzzles(filters);
  return filtered[Math.floor(Math.random() * filtered.length)];
}

/**
 * Get a puzzle by ID.
 * @param {number} id
 * @returns {object|undefined}
 */
export function getPuzzleById(id) {
  return puzzles.find(p => p.id === id);
}
