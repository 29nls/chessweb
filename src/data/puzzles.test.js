import { Chess } from 'chess.js';
import puzzles from './puzzles';

describe('puzzle dataset integrity', () => {
  test('every puzzle has a valid FEN and a fully legal solution line', () => {
    expect(puzzles.length).toBeGreaterThan(0);

    for (const puzzle of puzzles) {
      const game = new Chess(puzzle.fen);

      for (const san of puzzle.moves) {
        try {
          const move = game.move(san, { sloppy: true });
          expect(move).not.toBeNull();
        } catch (error) {
          throw new Error(`Puzzle ${puzzle.id} has invalid move "${san}": ${error.message}`);
        }
      }
    }
  });
});
