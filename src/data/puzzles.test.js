import { Chess } from 'chess.js';
import puzzles from './puzzles';

describe('puzzle dataset integrity', () => {
  test('every puzzle has a valid FEN and legal solution line', () => {
    expect(puzzles).not.toHaveLength(0);

    for (const puzzle of puzzles) {
      const game = new Chess(puzzle.fen);

      for (const [index, san] of puzzle.moves.entries()) {
        try {
          if (!game.move(san, { sloppy: true })) {
            throw new Error('returned null');
          }
        } catch (error) {
          throw new Error(
            `Puzzle ${puzzle.id}, move ${index + 1} ("${san}"): ${error.message}`
          );
        }
      }
    }
  });
});
