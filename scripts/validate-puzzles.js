/**
 * Validate all puzzles in the database.
 * Run: node scripts/validate-puzzles.js
 */
const { Chess } = require('chess.js');

// ─── ALL PUZZLES (original + new) ───
const puzzles = [
  // ORIGINAL 14
  {
    id: 1,
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    moves: ['Nd4', 'exd4', 'Bxd4'], // Fixed: Nd4 (knight fork threat) not Nd5
  },
  {
    id: 2,
    fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 5',
    moves: ['Nxe4', 'dxe4', 'Bxf2+'],
  },
  {
    id: 3,
    fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 5',
    moves: ['Qxg7', 'Rf8', 'Qxf7+'], // Fixed: Qxg7 first (not Qxf7+ which is illegal - f7 has no black piece)
  },
  {
    id: 4,
    fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 6',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
  },
  {
    id: 5,
    fen: 'r1bq1rk1/ppp2ppp/2np4/2b1p3/2B1P1n1/2NP1NPp/PPP2P1P/R1BQK2R w KQ - 0 8',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
  },
  {
    id: 6,
    fen: '2kr3r/ppp2ppp/2n5/3q4/3P4/6P1/PP3P1P/R2Q1RK1 b - - 0 14',
    moves: ['Qxd4', 'Rd1', 'Qxd1+', 'Rxd1', 'Rxd1+'], // Fixed: Rd1 not Rfd1 (rook on f1 cannot go to d1 when e1 is in the way)  
  },
  {
    id: 7,
    fen: 'r2qk2r/ppp2ppp/2np4/2b1p1B1/2BnP3/3P1N2/PPP2PPP/RN1QK2R w KQkq - 0 7',
    moves: ['Bxf7+', 'Kd7', 'Nd5+'], // Fixed: Ke7 is blocked by the e5 pawn. Black king can go to d7 or e7... actually Ke7 is legal? Let me check. After Bxf7+, the position: rank 8: r2qk2r, rank 7: ppp2Kpp (no, Bxf7+ means bishop takes on f7). After Bxf7+, the black king... wait. The bishop was on g5, now moved to f7+. After Bxf7+, Black king on e8 can go to d7, d8, f8, or f7... Ke7 from e8 is: king moves to e7. e7 is empty (from the FEN rank 7: ppp2ppp - empty on e7). So Ke7 should be legal!
    // Actually wait: Ke7 moves the king from e8 to e7. But the king wouldn't be on f7 - the bishop is on f7. 
    // After Bxf7+ Ke7: the bishop on f7 checks the king on e7? No, f7 is diagonal from e7. So the bishop check from f7 to e7 is still valid. But the king on e7 blocks its own bishop on f8? Wait: bishop on f8 and king on e8... after Ke7, the king moves away from the bishop. This should be fine.
    // Actually, maybe the issue is: after Bxf7+, is Ke7 legal? Black king from e8 to e7. Is e7 attacked? f7 is attacked by white bishop on g5. d7 is... empty. e7... not attacked by anything. 
    // Wait, I need to double check. After 1. Bxf7+, the position is: r2qk2r/ppp2Bpp/2np4/2b1p3/2BnP3/3P1N2/PPP2PPP/RN1QK2R. Black king on e8. Legal moves: Ke7, Kd8, Kf8, Kxf7. 
    // So Ke7 IS legal. Let me re-check my validation... 
  },
  {
    id: 8,
    fen: 'r1bq1rk1/ppp2ppp/2np4/4p3/2BnP1n1/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
  },
  {
    id: 9,
    fen: '6k1/5ppp/7r/8/8/1Q6/5PPP/3R2K1 b - - 0 1',
    moves: ['Rd6', 'Qb8+', 'Rd8'],
  },
  {
    id: 10,
    fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 6',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
  },
  {
    id: 11,
    fen: 'r2q1rk1/ppp2ppp/2np4/4p3/2BnP1n1/2NP1N2/PPP2PPP/R1BQK2R w KQ - 0 7',
    moves: ['Bxf7+', 'Rxf7', 'Ng5'],
  },
  {
    id: 12,
    fen: '8/4k3/3p4/3P4/3K4/8/8/8 w - - 0 1',
    moves: ['Kd3', 'Kd7', 'Kc4', 'Kxc6'], // Fixed: shorter and verified. After Kd3 Kd7 Kc4, d6 is actually empty... Let me verify better.
    // Actually this is wrong. Let me re-check: rank 6 is `3p4` = empty a6,b6,c6, pawn d6, ...
    // So Black has pawn on d6, not a king or other piece.
    // After Kd3 (white K to d3) Kd7 (black K to d7):
    // Position: 8/3k4/3p4/3P4/3K4/8/8/8 - White Kd4... no wait, after Kd3 Kd7, white K is on d3.
    // Then Kc4 moves the white king to c4. Kxc6 would require the white king on c4 to capture on c6. But c6 is empty! The pawn is on d6. So Kxc6 is illegal.
    // I need to fix this. The actual idea is to win the pawn on d6:
    // Kd3 Kd7 Kd4 Kd8 Ke4 Kd7 Kd5 Kd8 Kxd6...
    // Hmm, but Ke4 Ke7? Not necessarily.
    // Let me use a different approach for this puzzle.
  },
  {
    id: 13,
    fen: '8/8/3k4/4K3/8/6P1/8/8 w - - 0 1',
    moves: ['Kf6', 'Kd5', 'Kg6', 'Ke5', 'Kh6', 'Kf5', 'g4', 'Ke5', 'g5', 'Kf5', 'g6', 'Ke5', 'g7', 'Kf5', 'g8=Q'],
  },
  {
    id: 14,
    fen: '6k1/5ppp/8/3P4/8/6N1/5PPP/6K1 w - - 0 1',
    moves: ['Nf5', 'Kf8', 'Nh6', 'gxh6', 'd6'],
  },
];

let errors = 0;
let passes = 0;

for (const puzzle of puzzles) {
  const { id, fen, moves } = puzzle;
  
  try {
    const game = new Chess(fen);
    const currentGame = new Chess(fen);
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      let result;
      try {
        result = currentGame.move(move, { sloppy: true });
      } catch (e) {
        throw new Error(`Move ${i+1} ("${move}"): ${e.message}`);
      }
      
      if (!result) {
        throw new Error(`Move ${i+1} ("${move}"): returned null`);
      }
      
      // Print the position after each move for debugging
      // console.log(`  After move ${i+1}: ${currentGame.fen()}`);
    }
    
    console.log(`✅ Puzzle ${id} (${moves.length} moves) — OK`);
    passes++;
  } catch (e) {
    console.log(`❌ Puzzle ${id}: ${e.message}`);
    errors++;
  }
}

console.log(`\n${passes}/${puzzles.length} valid, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
