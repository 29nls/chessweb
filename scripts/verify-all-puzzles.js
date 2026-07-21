const { Chess } = require('chess.js');

// ALL puzzles — both original (fixed) and new
const puzzles = [
  // ─── Fork / Double Attack ───
  { id: 1, fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', moves: ['Ng5', 'Nxe4', 'Nxf7'] },
  { id: 2, fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 5', moves: ['Nxe4', 'dxe4', 'Bxf2+'] },
  // ─── Sacrifice / Mating Attack ───
  { id: 3, fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 5', moves: ['Qxg7', 'Rg8', 'Qxf7+'] },
  { id: 4, fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 6', moves: ['Bxf7+', 'Rxf7', 'Ng5'] },
  // ─── Pin / Skewer ───
  { id: 5, fen: 'r1bq1rk1/ppp2ppp/2np4/2b1p3/2B1P1n1/2NP1NPp/PPP2P1P/R1BQK2R w KQ - 0 8', moves: ['Bxf7+', 'Rxf7', 'Ng5'] },
  { id: 6, fen: '2kr3r/ppp2ppp/2n5/8/3q4/4R3/PP3PPP/3Q1RK1 w - - 0 15', moves: ['Re4', 'Nxe4', 'Qxd4'] },
  // ─── Discovered Attack ───
  { id: 7, fen: 'r2qk2r/ppp2ppp/2np4/2b1p1B1/2BnP3/3P1N2/PPP2PPP/RN1QK2R w KQkq - 0 7', moves: ['Nxd4', 'Bxd4', 'Bxf7+', 'Kxf7', 'Nxe5+'] },
  { id: 8, fen: 'r1bq1rk1/ppp2ppp/2np4/4p3/2BnP1n1/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7', moves: ['Bxf7+', 'Rxf7', 'Ng5'] },
  // ─── Back Rank Mate ───
  { id: 9, fen: '6k1/5ppp/7r/8/8/1Q6/5PPP/3R2K1 b - - 0 1', moves: ['Rd6', 'Qb8+', 'Rd8'] },
  // ─── Deflection ───
  { id: 10, fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 6', moves: ['Bxf7+', 'Rxf7', 'Ng5'] },
  // ─── Interference ───
  { id: 11, fen: 'r2q1rk1/ppp2ppp/2np4/4p3/2BnP1n1/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7', moves: ['Bxf7+', 'Rxf7', 'Ng5'] },
  // ─── Pawn Endgame ───
  { id: 12, fen: '8/8/8/3k4/8/3K1P2/8/8 w - - 0 1', moves: ['Kd4', 'Kd6', 'f4', 'Ke6', 'f5+', 'Kf6', 'Kd5', 'Kxf5', 'Kd6', 'Kf4', 'Kd7', 'Kf5', 'Kd8', 'Kf6', 'Kd7', 'Kf7', 'Kd8', 'Kf8'] },
  { id: 13, fen: '8/8/3k4/4K3/8/6P1/8/8 w - - 0 1', moves: ['Kf6', 'Kd5', 'Kg6', 'Ke5', 'Kh6', 'Kf5', 'g4', 'Ke5', 'g5', 'Kf5', 'g6', 'Ke5', 'g7', 'Kf5', 'g8=Q'] },
  // ─── Smothered Mate ───
  { id: 14, fen: '6k1/5ppp/8/3P4/8/6N1/5PPP/6K1 w - - 0 1', moves: ['Nf5', 'Kf8', 'Nh6', 'gxh6', 'd6'] },
  // ════════════════════════ NEW PUZZLES ════════════════════════
  // ZUGZWANG
  { id: 15, fen: 'k7/8/1K6/1PP5/8/8/8/8 w - - 0 1', moves: ['Ka6', 'Kb8', 'b6', 'Ka8', 'b7+', 'Kb8', 'c6'] },
  { id: 16, fen: '8/8/8/3k4/3K4/8/3P4/8 w - - 0 1', moves: ['d3', 'Kd6', 'Kc4', 'Kc6', 'Kd4', 'Kd6', 'Kc3', 'Kc7', 'Kc4', 'Kc6', 'Kd3', 'Kd5', 'Kc3', 'Kc5', 'Kd2', 'Kc4', 'Kc2', 'Kd4', 'Kd2', 'Ke4', 'Ke2', 'Kd4', 'Kf3', 'Kd3', 'd4', 'Kd2', 'Kf2'] },
  { id: 17, fen: 'k7/8/1K6/4P3/8/8/8/8 w - - 0 1', moves: ['e6', 'Kb8', 'Ka6', 'Ka8', 'e7', 'Kb8', 'e8=Q+', 'Ka7', 'Qa4+', 'Kb8', 'Kb6', 'Kc8', 'Qc6+', 'Kb8', 'Qb7#'] },

  // ZWISCHENZUG
  { id: 18, fen: 'r1bqkb1r/ppp2ppp/2np4/4p3/2B1P1n1/2NP1N2/PPP3PP/R1BQK2R w KQkq - 0 1', moves: ['Bxf7+', 'Kxf7', 'Nxe5+', 'Kf8', 'Nxg4'] },
  { id: 19, fen: 'r1bq1rk1/ppp2ppp/2np4/8/2B1P1n1/2NP4/PPP3PP/R1BQK2R w KQ - 0 1', moves: ['Bxf7+', 'Rxf7', 'Qxg4'] },
  { id: 20, fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', moves: ['Nxe5', 'd6', 'Nxf7', 'Kxf7', 'Bc4+', 'd5', 'Bxd5+', 'Be6', 'Bxe6+', 'Kxe6'] },

  // ENDGAME
  { id: 21, fen: '6k1/5p2/6K1/6P1/8/8/8/8 w - - 0 1', moves: ['g6', 'fxg6', 'Kxg7'] },
  { id: 22, fen: '8/8/8/8/4k3/8/5PK1/8 w - - 0 1', moves: ['Kf3', 'Kd4', 'Kg4', 'Ke4', 'Kh5', 'Kf5', 'Kh6', 'Kf6', 'g4', 'Kf7', 'g5', 'Kg8', 'Kg6', 'Kf8', 'Kf6', 'Kg8', 'g6', 'Kf8', 'g7+', 'Kg8', 'Kf5', 'Kh7', 'Kf6', 'Kh6', 'g8=Q', 'Kh5', 'Qg6', 'Kh4', 'Qg5+', 'Kh3', 'Kf5', 'Kh4', 'Qg4#'] },
  { id: 23, fen: '8/8/8/2k5/8/3K4/1P6/8 w - - 0 1', moves: ['Kc3', 'Kd5', 'Kd3', 'Kc5', 'Kc3', 'Kd5', 'Kb4', 'Kd4', 'Kb5', 'Kd5', 'b4', 'Kd4', 'b5', 'Kd5', 'b6', 'Kd6', 'Kc4', 'Kc6', 'b7', 'Kd6', 'b8=Q+', 'Kd7', 'Kd5', 'Ke7', 'Ke5', 'Kf7', 'Kf5', 'Kg7', 'Qg3+', 'Kf8', 'Kf6', 'Ke8', 'Qe5+', 'Kd8', 'Qd5+', 'Ke8', 'Qg8#'] },
  { id: 24, fen: '8/8/1k6/2p5/2K5/8/8/8 w - - 0 1', moves: ['Kxc5', 'Kb7', 'Kd6', 'Kc8', 'Kc6', 'Kd8', 'Kd6', 'Kc8', 'Kc6', 'Kd8', 'Kb7', 'Kd7', 'Kb6', 'Kd6', 'Kb5', 'Kd5', 'Kb4', 'Kd4', 'Kb3', 'Kd3', 'Kb2', 'Kd2', 'Kb1', 'Kd1', 'Kb2', 'Kd2', 'Kb3', 'Kd3', 'Kc4', 'Kd2', 'Kd4', 'Ke2', 'Ke4', 'Kd2', 'Kd4', 'Ke2', 'Kc4', 'Kd2', 'Kd4', 'Ke2', 'Ke4', 'Kd2', 'Kd4', 'Ke2', 'Kc4', 'Kd2', 'Kb4', 'Kd3', 'Kc5', 'Kd2', 'Kd4', 'Ke2', 'Ke4', 'Kd2', 'Kd4', 'Ke2', 'Kc4', 'Kd2', 'Kb4', 'Kd3', 'Kb3', 'Kd4', 'Kc2', 'Kd5', 'Kd3', 'Kd5', 'Kc2', 'Kc4', 'Kd2', 'Kb4', 'Kd3', 'Kb3', 'Kd4', 'Kxb2', 'Kc4', 'Kxa3'] },

  // ADVANCED TACTICS
  { id: 25, fen: '2kr3r/pp3ppp/2n5/2p5/3q4/6P1/PP3P1P/R3R1K1 b - - 0 14', moves: ['Qxd1', 'Rxd1', 'Rxd1+', 'Kf2', 'Rd2+', 'Kg1', 'Rxb2'] },
  { id: 26, fen: '5rk1/1p3ppp/1q6/3p4/5Q2/2P3P1/1P3P1P/5RK1 b - - 0 1', moves: ['Qb1+', 'Qf1', 'Qxa2'] },
];

let ok = 0; let fail = 0;
for (const p of puzzles) {
  try {
    const g = new Chess(p.fen);
    for (let i = 0; i < p.moves.length; i++) {
      const result = g.move(p.moves[i], { sloppy: true });
      if (!result) throw new Error(`Move ${i+1} "${p.moves[i]}" returned null`);
    }
    console.log(`✅ Puzzle ${p.id} (${p.moves.length} moves)`);
    ok++;
  } catch (e) {
    console.log(`❌ Puzzle ${p.id}: ${e.message}`);
    fail++;
  }
}
console.log(`\n${ok}/${ok+fail} valid, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
