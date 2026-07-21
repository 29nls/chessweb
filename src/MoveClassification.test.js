import { classifyMove, calculateLoss, LABELS } from './MoveClassification';

describe('calculateLoss', () => {
  test('white perspective: positive when eval drops', () => {
    expect(calculateLoss(100, -50, 'w')).toBe(150);
  });

  test('black perspective: positive when position improves for white', () => {
    // afterEval better for white => worse for black => positive loss
    expect(calculateLoss(0, 100, 'b')).toBe(100);
  });

  test('negative when the side improves its position', () => {
    expect(calculateLoss(-50, 100, 'w')).toBe(-150);
  });
});

describe('classifyMove', () => {
  test('uses distinct badges for a miss and an inaccuracy', () => {
    expect(LABELS.MISS.icon).not.toBe(LABELS.INACCURACY.icon);
  });

  test('engine moves are always at least BEST', () => {
    expect(classifyMove(500, 0, 0, true)).toBe(LABELS.BEST);
  });

  test('large gain => BRILLIANT', () => {
    expect(classifyMove(-350, 0, 350, false)).toBe(LABELS.BRILLIANT);
  });

  test('medium gain => GREAT', () => {
    expect(classifyMove(-200, 0, 200, false)).toBe(LABELS.GREAT);
  });

  test('small gain => EXCELLENT', () => {
    expect(classifyMove(-60, 0, 60, false)).toBe(LABELS.EXCELLENT);
  });

  test('small loss => GOOD', () => {
    expect(classifyMove(10, 50, 40, false).label).toBe('Good');
  });

  test('big loss => BLUNDER', () => {
    expect(classifyMove(350, 50, -300, false)).toBe(LABELS.BLUNDER);
  });

  test('loss >= 150 => MISTAKE', () => {
    expect(classifyMove(160, 50, -110, false)).toBe(LABELS.MISTAKE);
  });

  test('loss 75-150 without winning-before => INACCURACY', () => {
    expect(classifyMove(90, 50, -40, false)).toBe(LABELS.INACCURACY);
  });

  test('MISS when a winning position is thrown away', () => {
    // before=220 (>=200), after=99 (<100), loss=121 (miss window, <150)
    const result = classifyMove(121, 220, 99, false);
    expect(result).toBe(LABELS.MISS);
  });
});
