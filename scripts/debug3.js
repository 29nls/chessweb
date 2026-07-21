const { Chess } = require('chess.js');

// Test the puzzle 22 position
const fen = '8/8/8/8/4k3/8/5PK1/8 w - - 0 1';
console.log('FEN:', fen);
try {
  const c = new Chess(fen);
  console.log('Parsed OK');
  console.log('Turn:', c.turn());
  const moves = c.moves({ verbose: false });
  console.log('Legal moves:', moves);
} catch (e) {
  console.log('Parse error:', e.message);
}

// Also verify the original puzzle generation script's first position
console.log('\n--- Test position ---');
const c = new Chess('8/8/8/4k3/4K3/8/8/8 w - - 0 1');
console.log('Parsed:', c.fen());
console.log('Moves:', c.moves());
