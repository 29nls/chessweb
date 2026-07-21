const { Chess } = require('chess.js');

// Helper: verify the FEN is valid and the first move is legal
function verify(fen, moves) {
  try {
    const g = new Chess(fen);
    const firstMove = moves[0].replace(/[+#]/g,'');
    const allMoves = g.moves({ verbose: false });
    if (!allMoves.includes(firstMove)) {
      return { ok: false, reason: `First move "${firstMove}" not legal. Legal: ${allMoves.slice(0,15).join(',')}...` };
    }
    return { ok: true };
  } catch(e) {
    return { ok: false, reason: e.message };
  }
}

const puzzles = [
  // ZUGZWANG PUZZLES
  // Position: White Kb6 Pe5 Black Ka8 — zugzwang after e6
  { id: 15, fen: 'k7/8/1K6/4P3/8/8/8/8 w - - 0 1',
    moves: ['e6','Kb8','Ka6','Ka8','e7','Kb8','e8=Q','Ka7','Qe3','Kb8','Kb6','Kc8','Qc5','Kd8','Qd6','Ke8','Qe6','Kd8','Qd6','Kc8','Qc6','Kb8','Kb6','Ka8','Qa6','Kb8','Qa7','Kc8','Qb7','Kd8','Qd7'], 
    rating: 1900, themes: ['Zugzwang','Pawn Endgame','Promotion'],
    description: 'White to play — force Black into zugzwang and promote with mate.' },

  { id: 16, fen: '8/3k4/8/3KP3/8/8/8/8 w - - 0 1',
    moves: ['Kd4','Kd6','Ke4','Kc6','Ke5','Kd7','Kd5','Kc7','e6','Kd8','Kd6','Ke8','e7','Kf7','Kd7','Kg7','e8=Q','Kf6','Qe6','Kg7','Ke7','Kg8','Qf5','Kh8','Kf7','Kg7','Qf8','Kg6','Qf6','Kh5','Qg5'], 
    rating: 1800, themes: ['Zugzwang','Pawn Endgame','Promotion'],
    description: 'White to play — outflank Black and promote the pawn.' },

  // ZWISCHENZUG PUZZLES  
  // Italian Game: White forks with Ng5, Black blunders Nxe4? → Nxf7 forks Q+R
  { id: 17, fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    moves: ['Ng5','Nxe4','Nxf7'],
    rating: 1200, themes: ['Zwischenzug','Fork','Trap'],
    description: 'White to play — a zwischenzug! Fork the queen and rook instead of retreating.' },

  // After Bxf7+ Kxf7, White has Nxe5+ forking king and bishop  
  { id: 18, fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4',
    moves: ['Bxf7+','Kxf7','Nxe5+','Ke8','Nxg6'],
    rating: 1500, themes: ['Zwischenzug','Intermediate Check','Fork'],
    description: 'White to play — insert a check, then capture the knight to win material.' },

  { id: 19, fen: 'r1bq1rk1/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQ - 0 4',
    moves: ['Bxf7+','Rxf7','Ng5','Rf8','Nxe6'],
    rating: 1600, themes: ['Zwischenzug','Intermediate Check','Fork'],
    description: 'White to play — sacrifice the bishop, then fork the queen and rook.' },

  // ENDGAME PUZZLES
  // K+P opposition: White Kd5 Pf5 Black Kd7
  { id: 20, fen: '8/3k4/8/3K1P2/8/8/8/8 w - - 0 1',
    moves: ['Kc5','Ke7','Kc6','Ke8','Kd6','Kf8','Ke6','Kg7','Ke7','Kg8','Kf6','Kf8','f6','Kg8','f7+','Kh7','f8=Q'],
    rating: 1800, themes: ['Endgame','Pawn Promotion','King Opposition'],
    description: 'White to play — use king opposition to promote the pawn.' },

  // K+P race: White needs to capture Black's a5 pawn before it promotes
  { id: 21, fen: '8/8/1k6/p7/P2K4/8/8/8 w - - 0 1',
    moves: ['Kc4','Ka6','Kb4','Kb6','Kxa4','Kc5','Kb3','Kd4','Kc2','Ke3','Kd1','Kf2','Ke2','Kg1','Kf3','Kh2','Kf4','Kh3','Kf5','Kg2','Ke5','Kf3','Kd5','Ke3','Kc6','Kd4','Kb6','Kc4','Kxa5'],
    rating: 2000, themes: ['Endgame','Pawn Race','King Maneuver'],
    description: 'White to play — march the king to capture Black\'s pawn before it promotes.' },

  // Back rank mate (another one)
  { id: 22, fen: '6k1/5ppp/7r/8/8/1Q6/5PPP/3R2K1 b - - 0 1',
    moves: ['Rd6','Qb8','Rd8'],
    rating: 1400, themes: ['Back Rank','Mate Threat'],
    description: 'Black to play — threaten mate on the back rank.' },

  // Queen trap: Black infiltrates with queen
  { id: 23, fen: '5rk1/1p3ppp/1q6/3p4/5Q2/2P3P1/1P3P1P/5RK1 b - - 0 1',
    moves: ['Qb1+','Qf1','Qxa2','Qd1','Qb2','Qe1','Qxc3'],
    rating: 1800, themes: ['Attrition','Queen Endgame','Deep Calculation'],
    description: 'Black to play — infiltrate with the queen and win multiple pawns.' },
];

console.log('Verifying puzzles...\n');
let ok = 0, fail = 0;
for (const p of puzzles) {
  const v = verify(p.fen, p.moves);
  if (v.ok) {
    console.log(`✅ P${p.id} (${p.moves.length}m) — ${p.themes[0]}`);
    ok++;
  } else {
    console.log(`❌ P${p.id}: ${v.reason}`);
    // Debug: show all legal moves for the first position
    try {
      const g = new Chess(p.fen);
      console.log(`   Turn: ${g.turn() === 'w' ? 'White' : 'Black'}`);
      console.log(`   Legal moves: ${g.moves({ verbose: false }).slice(0,25).join(', ')}`);
    } catch(e) { console.log(`   Parse error: ${e.message}`); }
    fail++;
  }
}

console.log(`\n${ok}/${ok+fail} valid, ${fail} failed`);

// Output valid puzzles
if (ok > 0) {
  console.log('\n=== VALID PUZZLES ===');
  for (const p of puzzles) {
    const v = verify(p.fen, p.moves);
    if (v.ok) {
      console.log(`\n{ id: ${p.id}, fen: '${p.fen}', moves: ${JSON.stringify(p.moves)}, rating: ${p.rating}, themes: ${JSON.stringify(p.themes)}, description: '${p.description}' },`);
    }
  }
}
