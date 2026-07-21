const { Chess } = require('chess.js');

// Helper: verify a puzzle from FEN + moves
function verifyPuzzle(fen, moves) {
  const g = new Chess(fen);
  for (const m of moves) {
    const r = g.move(m.replace(/[+#]/g,''), { sloppy: true });
    if (!r) {
      console.log(`  FAIL at "${m}": ${g.fen()}`);
      return null;
    }
  }
  return fen;
}

const results = [];

// ─── ENDGAME: Simple pawn promotion ───
// White Kf2 Pg2 vs Black Ke4 (classic pawn opposition practice)
{
  const fen = '8/8/8/8/4k3/8/5PK1/8 w - - 0 1';
  const moves = ['Kf3','Kd4','Kg4','Ke4','Kh5','Kf5','Kh6','Kf6','g4','Kg8','g5','Kf8','Kh7','Ke8','g6','Kf8','g7','Kf7','g8=Q','Kf6','Qg5','Kf7','Qe5','Kf8','Kf6'];
  if (verifyPuzzle(fen, moves)) {
    results.push({ id: 22, fen, moves, rating: 1900, themes: ['Endgame', 'Pawn Promotion'], description: 'White to play — guide the pawn to promotion using opposition.' });
    console.log('✅ Endgame 22 (25 moves)');
  }
}

// ─── ZUGZWANG: Simple zugzwang ───
// White Kb7 Pa7 vs Black Ka8 - White wins by zugzwang
{
  const fen = 'k7/1P6/K7/8/8/8/8/8 w - - 0 1';
  const moves = ['Kb6','Kb8','Ka6','Ka8','b8=Q','Kc7','Qc7+','Kd8','Qd7+','Ke8','Qd7+','Kf8','Qf7+','Kg8','Qg7+','Kh8','Qg8+','Kxg8','Kf6'];
  // hmm this is too complex
}

// ─── ZUGZWANG: Simple K+P vs K ───
// White Kc6 Pc5 Black Kb8 - classic zugzwang
{
  // Actually this might be: 1. Kb6 Ka8 2. c6 Kb8 3. c7+ Kc8 4. Kc6 = stalemate? No, Kc6 Kd8 5. c8=Q+
  const g = new Chess();
  // Start with simple setup: Kb6, Pc5, Ka8
  const fen = 'k7/8/1K6/2P5/8/8/8/8 w - - 0 1';
  try {
    const g = new Chess(fen);
    const moves = ['Ka6','Kb8','Kb6','Ka8','c6','Kb8','c7+','Ka8','c8=Q+','Kb8','Qd8+','Kb7','Qd7+','Kb8','Qd7+','Kb6','Qb7+','Ka5','Qb5#'];
    // Verify each move
    let ok = true;
    for (const m of moves) {
      if (!g.move(m.replace(/[+#]/g,''), { sloppy: true })) { ok = false; break; }
    }
    if (ok) {
      results.push({ id: 15, fen, moves, rating: 1700, themes: ['Zugzwang', 'Pawn Endgame'], description: 'White to play — use zugzwang to force promotion and checkmate.' });
      console.log('✅ Zugzwang 15 (19 moves)');
    }
  } catch(e) { console.log('❌ Zugzwang 15: ' + e.message); }
}

// ─── ZWISCHENZUG: Check before capturing ───
// Position from the Italian Game where a zwischenzug check wins material
{
  // Set up: Classical Italian Game position, Black just played Nxe4
  // White can play Bxf7+ first (zwischenzug check), then capture the knight
  const fen = 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';
  const moves = ['Bxf7+','Kxf7','Nxe5+','Ke8','Nxg6'];
  let ok = true;
  try {
    const g = new Chess(fen);
    for (const m of moves) {
      if (!g.move(m.replace(/[+#]/g,''), { sloppy: true })) { ok = false; break; }
    }
    if (ok) {
      results.push({ id: 18, fen, moves, rating: 1500, themes: ['Zwischenzug', 'Intermediate Check', 'Fork'], description: 'White to play — insert a check before capturing the knight.' });
      console.log('✅ Zwischenzug 18 (5 moves)');
    }
  } catch(e) { console.log('❌ Zwischenzug 18: ' + e.message); }
}

// ─── ZWISCHENZUG #2 ───
// Similar position but with rook on f8 instead of bishop
{
  const fen = 'r1bq1rk1/pppp1ppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQ - 0 4';
  const moves = ['Bxf7+','Rxf7','Ng5','Rf8','Nxe6'];
  let ok = true;
  try {
    const g = new Chess(fen);
    for (const m of moves) {
      if (!g.move(m.replace(/[+#]/g,''), { sloppy: true })) { ok = false; break; }
    }
    if (ok) {
      results.push({ id: 19, fen, moves, rating: 1600, themes: ['Zwischenzug', 'Intermediate Check', 'Fork'], description: 'White to play — sacrifice the bishop then fork queen and rook.' });
      console.log('✅ Zwischenzug 19 (5 moves)');
    }
  } catch(e) { console.log('❌ Zwischenzug 19: ' + e.message); }
}

// ─── ENDGAME #2: Simple king opposition ───
// White Kd5 Pf5 Black Kd7 - classic distant opposition
{
  const fen = '8/3k4/8/3K1P2/8/8/8/8 w - - 0 1';
  const moves = ['Kc5','Ke7','Kc6','Ke8','Kd6','Kf8','Ke6','Kg7','Ke7','Kg8','Kf6','Kf8','f6','Kg8','f7+','Kh7','f8=Q'];
  let ok = true;
  try {
    const g = new Chess(fen);
    for (const m of moves) {
      if (!g.move(m.replace(/[+#]/g,''), { sloppy: true })) { ok = false; break; }
    }
    if (ok) {
      results.push({ id: 21, fen, moves, rating: 1800, themes: ['Endgame', 'Pawn Promotion', 'King Opposition'], description: 'White to play — use king opposition to promote the pawn.' });
      console.log('✅ Endgame 21 (17 moves)');
    }
  } catch(e) { console.log('❌ Endgame 21: ' + e.message); }
}

// ─── ENDGAME #3: Pawn race ───
// White needs to promote first while stopping Black's promotion
{
  const fen = '8/8/1k6/p7/P2K4/8/8/8 w - - 0 1';
  const moves = ['Kc4','Ka6','Kb4','Kb6','Kxa4','Kc5','Kb3','Kd4','Kc2','Ke3','Kd1','Kf2','Ke2','Kg1','Kf3','Kh2','Kf4','Kh3','Kf5','Kg2','Ke5','Kf3','Kd5','Ke3','Kc6','Kd4','Kb6','Kc4','Kxa5','Kc3'];
  let ok = true;
  try {
    const g = new Chess(fen);
    for (const m of moves) {
      if (!g.move(m.replace(/[+#]/g,''), { sloppy: true })) { ok = false; break; }
    }
    if (ok) {
      results.push({ id: 23, fen, moves, rating: 2000, themes: ['Endgame', 'Pawn Race', 'King Maneuver'], description: 'White to play — march the king to capture Black\'s a5 pawn before it promotes.' });
      console.log('✅ Endgame 23 (30 moves)');
    }
  } catch(e) { console.log('❌ Endgame 23: ' + e.message); }
}

// ─── SIMPLE TRAP: Queen trap ───
{
  const fen = '5rk1/1p3ppp/1q6/3p4/5Q2/2P3P1/1P3P1P/5RK1 b - - 0 1';
  const moves = ['Qb1+','Qf1','Qxa2','Qd1','Qb2','Qe1','Qxc3'];
  let ok = true;
  try {
    const g = new Chess(fen);
    for (const m of moves) {
      if (!g.move(m.replace(/[+#]/g,''), { sloppy: true })) { ok = false; break; }
    }
    if (ok) {
      results.push({ id: 26, fen, moves, rating: 1800, themes: ['Attrition', 'Queen Endgame', 'Deep Calculation'], description: 'Black to play — infiltrate with the queen and win multiple pawns.' });
      console.log('✅ Queen trap 26 (7 moves)');
    }
  } catch(e) { console.log('❌ Queen trap 26: ' + e.message); }
}

console.log(`\n${results.length} verified puzzles generated.`);

// Output as JavaScript module
console.log('\n// Puzzle objects:');
for (const r of results) {
  console.log(`{ id: ${r.id}, fen: '${r.fen}', moves: ${JSON.stringify(r.moves)}, rating: ${r.rating}, themes: ${JSON.stringify(r.themes)}, description: '${r.description}' },`);
}
