const { Chess } = require('chess.js');

const puzzles = [
  // ── Existing (fixed) ──
  { id: 1,  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',       moves: ['Ng5','Nxe4','Nxf7'] },
  { id: 2,  fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 5',    moves: ['Nxe4','dxe4','Bxf2'] },
  { id: 3,  fen: '5rk1/ppp2ppp/2n5/4q3/8/6P1/PP3P1P/3QR1K1 w - - 0 14',                      moves: ['Rxe5','Nxe5','Qxe5'] },
  { id: 4,  fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 6',    moves: ['Bxf7','Rxf7','Ng5'] },
  { id: 5,  fen: 'r1bq1rk1/ppp2ppp/2np4/2b1p3/2B1P1n1/2NP1NPp/PPP2P1P/R1BQK2R w KQ - 0 8',  moves: ['Bxf7','Rxf7','Ng5'] },
  { id: 6,  fen: 'r3k2r/ppp2ppp/2n5/4B1q1/8/6P1/PP3P1P/3QR1K1 b - - 0 14',                   moves: ['Qxe5','Rxe5','Rxe5'] },
  { id: 7,  fen: 'r2qk2r/ppp2ppp/2np4/2b1p1B1/2BnP3/3P1N2/PPP2PPP/RN1QK2R w KQkq - 0 7',    moves: ['Bxf7','Kd7','Nxe5','Kd8','Nxg6'] },
  { id: 8,  fen: 'r1bq1rk1/ppp2ppp/2np4/4p3/2BnP1n1/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7',     moves: ['Bxf7','Rxf7','Ng5'] },
  { id: 9,  fen: '6k1/5ppp/7r/8/8/1Q6/5PPP/3R2K1 b - - 0 1',                                 moves: ['Rd6','Qb8','Rd8'] },
  { id: 10, fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 6',   moves: ['Bxf7','Rxf7','Ng5'] },
  { id: 11, fen: 'r2q1rk1/ppp2ppp/2np4/4p3/2BnP1n1/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7',     moves: ['Bxf7','Rxf7','Ng5'] },
  { id: 12, fen: '8/8/8/3k4/5P2/3K4/8/8 w - - 0 1',                                          moves: ['Ke3','Ke5','f5','Kxf5','Kd4','Ke6','Kc5','Kd7','Kd5','Kc7','Ke6','Kc6','f6','Kc7','f7','Kd8','f8=Q'] },
  { id: 13, fen: '8/8/3k4/4K3/8/6P1/8/8 w - - 0 1',                                           moves: ['Kf6','Kd5','Kg6','Ke5','Kh6','Kf5','g4','Ke5','g5','Kf5','g6','Ke5','g7','Kf5','g8=Q'] },
  { id: 14, fen: '6k1/5ppp/8/3P4/8/6N1/5PPP/6K1 w - - 0 1',                                   moves: ['Nf5','Kf8','Nh6','gxh6','d6'] },
  // ── NEW: Zugzwang ──
  { id: 15, fen: 'k7/8/1K6/4P3/8/8/8/8 w - - 0 1',                                            moves: ['e6','Kb8','Ka6','Ka8','e7','Kb8','e8=Q','Ka7','Qa4','Kb8','Kb6','Kc8','Qc6','Kb8','Qb7'] },
  { id: 16, fen: '8/8/8/8/2k5/3K4/3P4/8 w - - 0 1',                                            moves: ['d4','Kd5','Kc3','Kc6','Kc4','Kd6','d5','Kd7','Kc5','Kd8','d6','Ke8','d7','Kf7','d8=Q'] },
  // ── NEW: Zwischenzug ──
  { id: 18, fen: 'r1bq1rk1/ppp2ppp/2n5/3np3/2B5/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 1',          moves: ['Nxe5','Nxe5','Bxf7','Rxf7','Qxd5'] },
  { id: 19, fen: 'r4rk1/ppp2ppp/2nq4/3np3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 1',          moves: ['Nxe5','Nxe5','Bxf7','Rxf7','Qxd5'] },
  // ── NEW: Endgame ──
  { id: 21, fen: '8/8/4k3/3K4/8/8/5P2/8 w - - 0 1',                                            moves: ['f4','Kd7','Ke5','Ke7','f5','Kd7','Kd5','Ke7','f6','Kf7','Kd6','Kf8','Ke6','Ke8','f7','Kf8','Kf6'] },
  { id: 22, fen: '8/8/8/8/4k3/8/5PK1/8 w - - 0 1',                                             moves: ['Kf3','Kd4','Kg4','Ke4','Kh5','Kf5','Kh6','Kf6','g4','Kg8','g5','Kf8','Kh7','Ke8','g6','Kf8','g7','Kf7','g8=Q','Kf6','Qg5','Kf7','Qe5','Kf8','Kf6'] },
  { id: 23, fen: '8/8/8/8/8/2k5/1P6/4K3 w - - 0 1',                                            moves: ['Kd1','Kd3','Kc1','Kc3','b4','Kd3','b5','Kd4','b6','Kc5','b7','Kc6','b8=Q','Kc5','Kd2','Kd4','Qb4','Kd5','Kd3','Ke5','Qc5','Kf6','Kd4','Kg6','Qe5','Kg7','Qf5','Kh6','Kd5','Kg7','Ke6','Kf8','Kf6','Kg8','Qe6','Kf8','Qf7'] },
  { id: 24, fen: '8/8/8/8/p3k3/2K5/8/8 w - - 0 1',                                             moves: ['Kb4','Kd4','Kxa4','Kc4'] },
  // ── NEW: Advanced ──
  { id: 26, fen: '5rk1/1p3ppp/1q6/3p4/5Q2/2P3P1/1P3P1P/5RK1 b - - 0 1',                      moves: ['Qb1','Qf1','Qxa2'] },
];

function strip(m) { return m.replace(/[+#]/g,''); }

let ok=0,fail=0;
for (const p of puzzles) {
  try {
    const g = new Chess(p.fen);
    for (let i = 0; i < p.moves.length; i++) {
      const result = g.move(strip(p.moves[i]), { sloppy: true });
      if (!result) throw new Error(`move ${i+1} "${p.moves[i]}" failed`);
    }
    console.log(`✅ P${p.id} (${p.moves.length}m)`);
    ok++;
  } catch (e) {
    const g = new Chess(p.fen);
    for (let i = 0; i < p.moves.length; i++) {
      try { g.move(strip(p.moves[i]), { sloppy: true }); }
      catch(e2) { 
        console.log(`❌ P${p.id} move ${i+1} "${p.moves[i]}": ${e2.message}`);
        break;
      }
    }
    fail++;
  }
}
console.log(`\n${ok}/${ok+fail} valid, ${fail} failed`);
