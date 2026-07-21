const { Chess } = require('chess.js');

// Test each puzzle candidate and output only ones that pass
function verify(fen, moves) {
  try {
    const g = new Chess(fen);
    for (const m of moves) {
      const r = g.move(m.replace(/[+#]/g,''), { sloppy: true });
      if (!r) { return { ok: false, at: m, fen: g.fen() }; }
    }
    return { ok: true, moves: moves.length };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

const candidates = [
  // Zugzwang
  { id: 15, fen: 'k7/8/1K6/4P3/8/8/8/8 w - - 0 1', moves: ['e6','Kb8','Ka6','Ka8','e7','Kb8','e8=Q','Ka7','Qe3','Kb8','Kb6','Kc8','Qc5+','Kd8','Qd5+','Ke8','Qd7+','Kf8','Qf7+','Kg8','Qg7+','Kh8','Qg8+'],
     r: 1900, t: ['Zugzwang','Pawn Endgame','Promotion'], d: 'White to play — use zugzwang to promote and force checkmate.' },

  // Zwischenzug
  { id: 18, fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', moves: ['Bxf7+','Kxf7','Nxe5+','Ke8','Nxg6'],
     r: 1500, t: ['Zwischenzug','Intermediate Check','Fork'], d: 'White to play — insert a check before capturing the knight.' },

  { id: 19, fen: 'r1bq1rk1/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQ - 0 4', moves: ['Bxf7+','Rxf7','Ng5','Rf8','Nxe6'],
     r: 1600, t: ['Zwischenzug','Intermediate Check','Fork'], d: 'White to play — sacrifice the bishop then fork queen and rook.' },

  // Endgame
  { id: 21, fen: '8/3k4/8/3K1P2/8/8/8/8 w - - 0 1', moves: ['Kc5','Ke7','Kc6','Ke8','Kd6','Kf8','Ke6','Kg7','Ke7','Kg8','Kf6','Kf8','f6','Kg8','f7+','Kh7','f8=Q'],
     r: 1800, t: ['Endgame','Pawn Promotion','King Opposition'], d: 'White to play — use king opposition to promote the pawn.' },

  { id: 22, fen: '8/8/1k6/p7/P2K4/8/8/8 w - - 0 1', moves: ['Kc4','Ka6','Kb4','Kb6','Kxa4','Kc5','Kb3','Kd4','Kc2','Ke3','Kd1','Kf2','Ke2','Kg1','Kf3','Kh2','Kf4','Kh3','Kf5','Kg2','Ke5','Kf3','Kd5','Ke3','Kc6','Kd4','Kb6','Kc4','Kxa5'],
     r: 2000, t: ['Endgame','Pawn Race','King Maneuver'], d: 'White to play — march the king to capture Black\'s pawn before it promotes.' },

  // Queen trap
  { id: 26, fen: '5rk1/1p3ppp/1q6/3p4/5Q2/2P3P1/1P3P1P/5RK1 b - - 0 1', moves: ['Qb1+','Qf1','Qxa2','Qd1','Qb2','Qe1','Qxc3'],
     r: 1800, t: ['Attrition','Queen Endgame'], d: 'Black to play — infiltrate with the queen and win multiple pawns.' },
];

console.log('Testing puzzle candidates...\n');
for (const c of candidates) {
  const v = verify(c.fen, c.moves);
  if (v.ok) {
    console.log(`✅ P${c.id} (${v.moves}m)`);
  } else {
    const at = v.error ? `error: ${v.error}` : `at "${v.at}" -> ${v.fen}`;
    console.log(`❌ P${c.id}: ${at}`);
  }
}

console.log('\n--- Generate output ---');
for (const c of candidates) {
  const v = verify(c.fen, c.moves);
  if (v.ok) {
    console.log(`\n{ id: ${c.id}, fen: '${c.fen}', moves: ${JSON.stringify(c.moves)}, rating: ${c.r}, themes: ${JSON.stringify(c.t)}, description: '${c.d}' },`);
  }
}
