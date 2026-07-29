import { Chess } from 'chess.js';
import { onlineReducer, initialOnlineState } from './onlinePageReducer';

const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function applyMove(state, san) {
  const game = new Chess(state.fen);
  const moveResult = game.move(san, { sloppy: true });
  const newFen = game.fen();
  return {
    state: onlineReducer(state, {
      type: 'RECORD_MOVE',
      payload: { moveResult, newFen },
    }),
    moveResult,
    newFen,
  };
}

describe('onlineReducer', () => {
  test('unknown action type returns the same state reference', () => {
    const result = onlineReducer(initialOnlineState, { type: 'UNKNOWN' });
    expect(result).toBe(initialOnlineState);
  });

  test('RESET_GAME returns a fresh starting position', () => {
    const { state: movedState } = applyMove(initialOnlineState, 'e4');
    const reset = onlineReducer(movedState, { type: 'RESET_GAME' });

    expect(reset.fen).toBe(startingFen);
    expect(reset.moves).toEqual([]);
    expect(reset.moveHistory).toEqual([startingFen]);
    expect(reset.historyPointer).toBe(0);
    expect(reset.lastMove).toBeNull();
    expect(reset.game.fen()).toBe(startingFen);
  });

  test('RESET_GAME clears takeback state', () => {
    const state = {
      ...initialOnlineState,
      pendingTakeback: true,
      takebackRequestState: { requester: 'player_1' },
    };
    const reset = onlineReducer(state, { type: 'RESET_GAME' });

    expect(reset.pendingTakeback).toBe(false);
    expect(reset.takebackRequestState).toBeNull();
  });
});

describe('RECORD_MOVE', () => {
  test('records a single move and updates derived state', () => {
    const { state } = applyMove(initialOnlineState, 'e4');

    expect(state.fen).toMatch(/^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR/);
    expect(state.moves).toEqual(['e4']);
    expect(state.moveHistory).toHaveLength(2);
    expect(state.moveHistory[0]).toBe(startingFen);
    expect(state.historyPointer).toBe(1);
    expect(state.lastMove).toEqual({ from: 'e2', to: 'e4' });
  });

  test('records multiple sequential moves', () => {
    let current = initialOnlineState;
    current = applyMove(current, 'e4').state;
    current = applyMove(current, 'e5').state;
    current = applyMove(current, 'Nf3').state;

    expect(current.moves).toEqual(['e4', 'e5', 'Nf3']);
    expect(current.moveHistory).toHaveLength(4);
    expect(current.historyPointer).toBe(3);
  });

  test('prunes future moves when recording from a prior history position', () => {
    let current = initialOnlineState;
    current = applyMove(current, 'e4').state;
    current = applyMove(current, 'e5').state;
    current = applyMove(current, 'Nf3').state;

    // Roll back to after e4
    const rolledBack = onlineReducer(current, {
      type: 'SYNC_STATE',
      payload: {
        fen: current.moveHistory[1],
        moves: ['e4'],
        moveHistory: current.moveHistory.slice(0, 2),
        orientation: 'white',
      },
    });

    const { state: replayed } = applyMove(rolledBack, 'Nc6');
    expect(replayed.moves).toEqual(['e4', 'Nc6']);
    expect(replayed.moveHistory).toHaveLength(3);
    expect(replayed.historyPointer).toBe(2);
  });

  test('handles a moveResult without a san gracefully', () => {
    const state = onlineReducer(initialOnlineState, {
      type: 'RECORD_MOVE',
      payload: { moveResult: { from: 'a2', to: 'a4' }, newFen: startingFen },
    });

    expect(state.moves).toEqual([]);
    expect(state.fen).toBe(startingFen);
  });
});

describe('SYNC_STATE', () => {
  test('syncs a valid state from payload', () => {
    const game = new Chess();
    game.move('e4');
    game.move('e5');
    const fen = game.fen();
    const moveHistory = [startingFen, new Chess(startingFen).move('e4').fen, fen];

    const state = onlineReducer(initialOnlineState, {
      type: 'SYNC_STATE',
      payload: {
        fen,
        moves: ['e4', 'e5'],
        moveHistory,
        orientation: 'black',
      },
    });

    expect(state.fen).toBe(fen);
    expect(state.moves).toEqual(['e4', 'e5']);
    expect(state.moveHistory).toEqual(moveHistory);
    expect(state.historyPointer).toBe(moveHistory.length - 1);
    expect(state.boardOrientation).toBe('black');
    expect(state.showLobby).toBe(false);
    expect(state.lastMove).toBeNull();
  });

  test('falls back to starting position when FEN is invalid', () => {
    const state = onlineReducer(initialOnlineState, {
      type: 'SYNC_STATE',
      payload: {
        fen: 'not-a-valid-fen',
        moves: ['e4'],
        moveHistory: ['not-a-valid-fen'],
        orientation: 'white',
      },
    });

    expect(state.fen).toBe(startingFen);
    expect(state.game.fen()).toBe(startingFen);
  });

  test('uses default values when optional fields are omitted', () => {
    const fen = new Chess().fen();
    const state = onlineReducer(initialOnlineState, {
      type: 'SYNC_STATE',
      payload: { fen },
    });

    expect(state.moves).toEqual([]);
    expect(state.moveHistory).toEqual([fen]);
    expect(state.boardOrientation).toBe('white');
  });
});

describe('TAKEBACK_ACCEPTED', () => {
  test('undoes the last move and updates history pointer', () => {
    let current = initialOnlineState;
    current = applyMove(current, 'e4').state;
    current = applyMove(current, 'e5').state;

    const undone = onlineReducer(current, {
      type: 'TAKEBACK_ACCEPTED',
      payload: { movesToUndo: 1 },
    });

    expect(undone.historyPointer).toBe(1);
    expect(undone.moves).toEqual(['e4']);
    expect(undone.fen).toBe(current.moveHistory[1]);
    expect(undone.pendingTakeback).toBe(false);
  });

  test('undoes multiple moves and reconstructs lastMove', () => {
    let current = initialOnlineState;
    current = applyMove(current, 'e4').state;
    current = applyMove(current, 'e5').state;
    current = applyMove(current, 'Nf3').state;

    const undone = onlineReducer(current, {
      type: 'TAKEBACK_ACCEPTED',
      payload: { movesToUndo: 2 },
    });

    expect(undone.historyPointer).toBe(1);
    expect(undone.moves).toEqual(['e4']);
    expect(undone.lastMove).toEqual({ from: 'e2', to: 'e4' });
  });

  test('does not underflow history pointer', () => {
    const state = onlineReducer(initialOnlineState, {
      type: 'TAKEBACK_ACCEPTED',
      payload: { movesToUndo: 5 },
    });

    expect(state.historyPointer).toBe(0);
    expect(state.fen).toBe(startingFen);
    expect(state.moves).toEqual([]);
  });

  test('clears takeback request state', () => {
    const state = {
      ...initialOnlineState,
      pendingTakeback: true,
      takebackRequestState: { requester: 'player_1' },
    };
    const undone = onlineReducer(state, {
      type: 'TAKEBACK_ACCEPTED',
      payload: { movesToUndo: 0 },
    });

    expect(undone.pendingTakeback).toBe(false);
    expect(undone.takebackRequestState).toBeNull();
  });

  test('handles lastMove reconstruction failure gracefully', () => {
    const state = {
      ...initialOnlineState,
      moves: ['!!invalid!!'],
      moveHistory: [startingFen, 'invalid'],
      historyPointer: 1,
    };

    const undone = onlineReducer(state, {
      type: 'TAKEBACK_ACCEPTED',
      payload: { movesToUndo: 1 },
    });

    expect(undone.historyPointer).toBe(0);
    expect(undone.lastMove).toBeNull();
  });
});
