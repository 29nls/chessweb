import {
  classifyIncomingMove,
  nextMoveSequence,
  MOVE_SEQUENCE_RESULT,
} from './moveSequence';

describe('classifyIncomingMove', () => {
  test('applies the next expected move', () => {
    expect(classifyIncomingMove({ sequence: 1, appliedCount: 0 })).toBe(MOVE_SEQUENCE_RESULT.APPLY);
    expect(classifyIncomingMove({ sequence: 5, appliedCount: 4 })).toBe(MOVE_SEQUENCE_RESULT.APPLY);
  });

  test('treats an already-applied sequence as a duplicate', () => {
    // Re-delivery of move 3 while 4 moves are on the board must not double-apply.
    expect(classifyIncomingMove({ sequence: 3, appliedCount: 4 })).toBe(MOVE_SEQUENCE_RESULT.DUPLICATE);
    expect(classifyIncomingMove({ sequence: 1, appliedCount: 1 })).toBe(MOVE_SEQUENCE_RESULT.DUPLICATE);
  });

  test('reports a gap when a move was missed', () => {
    // We have 2 moves, the opponent sends move 5: moves 3 and 4 never arrived.
    expect(classifyIncomingMove({ sequence: 5, appliedCount: 2 })).toBe(MOVE_SEQUENCE_RESULT.GAP);
    expect(classifyIncomingMove({ sequence: 2, appliedCount: 0 })).toBe(MOVE_SEQUENCE_RESULT.GAP);
  });

  test('accepts moves from peers that send no sequence', () => {
    expect(classifyIncomingMove({ sequence: undefined, appliedCount: 3 })).toBe(MOVE_SEQUENCE_RESULT.APPLY);
    expect(classifyIncomingMove({ sequence: null, appliedCount: 3 })).toBe(MOVE_SEQUENCE_RESULT.APPLY);
    expect(classifyIncomingMove({ sequence: NaN, appliedCount: 3 })).toBe(MOVE_SEQUENCE_RESULT.APPLY);
  });

  test('treats a missing or invalid applied count as an empty board', () => {
    expect(classifyIncomingMove({ sequence: 1, appliedCount: undefined })).toBe(MOVE_SEQUENCE_RESULT.APPLY);
    expect(classifyIncomingMove({ sequence: 1, appliedCount: -5 })).toBe(MOVE_SEQUENCE_RESULT.APPLY);
    expect(classifyIncomingMove({ sequence: 2, appliedCount: undefined })).toBe(MOVE_SEQUENCE_RESULT.GAP);
  });

  test('does not throw on an empty payload', () => {
    expect(() => classifyIncomingMove({})).not.toThrow();
    expect(classifyIncomingMove({})).toBe(MOVE_SEQUENCE_RESULT.APPLY);
  });
});

describe('nextMoveSequence', () => {
  test('returns 1-based sequence numbers', () => {
    expect(nextMoveSequence(0)).toBe(1);
    expect(nextMoveSequence(1)).toBe(2);
    expect(nextMoveSequence(41)).toBe(42);
  });

  test('normalizes invalid counts to the first move', () => {
    expect(nextMoveSequence(undefined)).toBe(1);
    expect(nextMoveSequence(null)).toBe(1);
    expect(nextMoveSequence(-3)).toBe(1);
    expect(nextMoveSequence(NaN)).toBe(1);
  });

  test('round-trips with classifyIncomingMove', () => {
    // The sequence a sender produces must be the one the receiver expects next.
    for (let applied = 0; applied < 10; applied += 1) {
      const sequence = nextMoveSequence(applied);
      expect(classifyIncomingMove({ sequence, appliedCount: applied })).toBe(MOVE_SEQUENCE_RESULT.APPLY);
      expect(classifyIncomingMove({ sequence, appliedCount: applied + 1 })).toBe(MOVE_SEQUENCE_RESULT.DUPLICATE);
    }
  });
});
