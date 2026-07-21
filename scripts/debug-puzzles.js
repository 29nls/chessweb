const { Chess } = require('chess.js');

const puzzles = [
  {
    id: 1,
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    moves: ['Nd4', 'exd4', 'Bxd4'],
  },
  {
    id: 3,
    fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 5',
    moves: ['Qxg7', 'Rf8', 'Qxf7+'],
  },
  {
    id: 6,
    fen: '2kr3r/ppp2ppp/2n5/3q4/3P4/6P1/PP3P1P/R2Q1RK1 b - - 0 14',
    moves: ['Qxd4', 'Rd1', 'Qxd1+', 'Rxd1', 'Rxd1+'],
  },
  {
    id: 7,
    fen: 'r2qk2r/ppp2ppp/2np4/2b1p1B1/2BnP3/3P1N2/PPP2PPP/RN1QK2R w KQkq - 0 7',
    moves: ['Bxf7+', 'Ke7', 'Nd5+'],
  },
  {
    id: 12,
    fen: '8/4k3/3p4/3P4/3K4/8/8/8 w - - 0 1',
    moves: ['Kd3', 'Kd7', 'Kc4', 'Kxc6'],
  },
];

for (const puzzle of puzzles) {
  console.log(`\n=== Puzzle ${puzzle.id} ===`);
  console.log(`FEN: ${puzzle.fen}`);
  
  let g;
  try {
    g = new Chess(puzzle.fen);
    console.log(`Parsed OK. Turn: ${g.turn() === 'w' ? 'White' : 'Black'}`);
  } catch (e) {
    console.log(`FEN parse error: ${e.message}`);
    continue;
  }

  for (let i = 0; i < Math.min(puzzle.moves.length, 5); i++) {
    const move = puzzle.moves[i];
    const side = g.turn() === 'w' ? 'White' : 'Black';
    console.log(`Move ${i+1} (${side}): "${move}"`);
    
    // Show legal moves for debugging
    const allMoves = g.moves();
    if (allMoves.length < 50) {
      console.log(`  Legal moves: ${allMoves.join(', ')}`);
    } else {
      console.log(`  Legal moves: ${allMoves.slice(0, 10).join(', ')}... (${allMoves.length} total)`);
    }
    
    // Check if the move matches any legal move
    if (!allMoves.includes(move)) {
      console.log(`  ❌ "${move}" NOT in legal moves!`);
      // Check the position
      console.log(`  Position: ${g.fen()}`);
      break;
    }
    
    try {
      const result = g.move(move, { sloppy: false });
      console.log(`  ✅ OK. New FEN: ${g.fen()}`);
    } catch (e) {
      console.log(`  ❌ Error: ${e.message}`);
      break;
    }
  }
}
