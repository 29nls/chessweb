import fs from 'fs';
import path from 'path';

const readSource = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');

test('puzzle and controls import package APIs by their named exports', () => {
  const puzzlePage = readSource('pages/PuzzlePage.js');
  const controls = readSource('Controls.js');

  expect(puzzlePage).toContain("import { Chess } from 'chess.js';");
  expect(puzzlePage).toContain("import { toast } from 'react-toastify';");
  expect(puzzlePage).toContain("import { getRandomPuzzle } from '../data/puzzles';");
  expect(puzzlePage).toContain("import { playMoveSound } from '../lib/sound';");
  expect(controls).toContain("import { toast } from 'react-toastify';");
});
