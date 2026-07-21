import { normalizeEvaluationToWhite } from './useChessEngine';

describe('normalizeEvaluationToWhite', () => {
  test('keeps a White-to-move mating score positive', () => {
    expect(normalizeEvaluationToWhite({ value: 3, type: 'mate' }, 'w')).toEqual({
      value: 3,
      type: 'mate',
    });
  });

  test('reverses every Black-to-move score, including secondary MultiPV mate lines', () => {
    expect(normalizeEvaluationToWhite({ value: 3, type: 'mate' }, 'b')).toEqual({
      value: -3,
      type: 'mate',
    });
  });
});
