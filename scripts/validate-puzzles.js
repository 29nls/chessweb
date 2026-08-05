/**
 * Validate the application's actual puzzle dataset.
 * Run: node scripts/validate-puzzles.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Chess } = require('chess.js');

function loadPuzzleDataset() {
  const sourcePath = path.resolve(__dirname, '../src/data/puzzles.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const start = source.indexOf('const puzzles = [');
  const end = source.indexOf('];', start);

  if (start === -1 || end === -1) {
    throw new Error(`Could not locate puzzle array in ${sourcePath}`);
  }

  return vm.runInNewContext(source.slice(source.indexOf('[', start), end + 2));
}

function validatePuzzle(puzzle) {
  const game = new Chess(puzzle.fen);

  for (let index = 0; index < puzzle.moves.length; index += 1) {
    const san = puzzle.moves[index];
    try {
      const move = game.move(san, { sloppy: true });
      if (!move) {
        throw new Error('returned null');
      }
    } catch (error) {
      throw new Error(`Move ${index + 1} ("${san}"): ${error.message}`);
    }
  }
}

let puzzles;
try {
  puzzles = loadPuzzleDataset();
} catch (error) {
  console.error(`❌ Failed to load source dataset: ${error.message}`);
  process.exit(1);
}

let errors = 0;
for (const puzzle of puzzles) {
  try {
    validatePuzzle(puzzle);
    console.log(`✅ Puzzle ${puzzle.id} (${puzzle.moves.length} moves) — OK`);
  } catch (error) {
    console.log(`❌ Puzzle ${puzzle.id}: ${error.message}`);
    errors += 1;
  }
}

console.log(`\n${puzzles.length - errors}/${puzzles.length} valid, ${errors} errors`);
process.exit(errors > 0 ? 1 : 0);
