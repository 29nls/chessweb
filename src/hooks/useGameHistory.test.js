import { renderHook, act } from '@testing-library/react';
import { Chess } from 'chess.js';
import { useGameHistory } from './useGameHistory';

describe('useGameHistory — jumpToMove', () => {
  /**
   * Build a realistic game scenario with known FEN history and moves.
   * Plays: 1.e4 e5 2.Nf3 Nc6
   * Returns: { history: string[], moves: string[] }
   */
  function buildScenario() {
    const g = new Chess();
    const initialFen = g.fen();

    g.move('e4');
    const fenE4 = g.fen();

    g.move('e5');
    const fenE5 = g.fen();

    g.move('Nf3');
    const fenNf3 = g.fen();

    g.move('Nc6');
    const fenNc6 = g.fen();

    return {
      history: [initialFen, fenE4, fenE5, fenNf3, fenNc6],
      moves: ['e4', 'e5', 'Nf3', 'Nc6'],
    };
  }

  test('does nothing when targetPointer < 0', () => {
    const { result } = renderHook(() => useGameHistory());
    const { history, moves } = buildScenario();
    const sendCommand = jest.fn();

    act(() => {
      result.current.jumpToMove(-1, history, moves, sendCommand);
    });

    // State should remain at initial values
    expect(result.current.historyPointer).toBe(0);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  test('does nothing when targetPointer >= currentHistory.length', () => {
    const { result } = renderHook(() => useGameHistory());
    const { history, moves } = buildScenario();
    const sendCommand = jest.fn();

    act(() => {
      // history.length = 5, so target 5 is out of bounds
      result.current.jumpToMove(5, history, moves, sendCommand);
    });

    expect(result.current.historyPointer).toBe(0);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  test('does nothing when currentHistory is empty (length 0)', () => {
    const { result } = renderHook(() => useGameHistory());
    const sendCommand = jest.fn();

    act(() => {
      result.current.jumpToMove(0, [], [], sendCommand);
    });

    expect(result.current.historyPointer).toBe(0);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  test('jumps to the initial position (targetPointer = 0)', () => {
    const { result } = renderHook(() => useGameHistory());
    const { history, moves } = buildScenario();
    const sendCommand = jest.fn();

    act(() => {
      result.current.jumpToMove(0, history, moves, sendCommand);
    });

    // Should jump to index 0 (starting position)
    expect(result.current.historyPointer).toBe(0);
    expect(result.current.fen).toBe(history[0]);
    expect(result.current.lastMove).toBeNull();
    expect(sendCommand).toHaveBeenCalledWith('ucinewgame');
    expect(sendCommand).toHaveBeenCalledWith(`position fen ${history[0]}`);
  });

  test('jumps to the middle of the game and reconstructs lastMove', () => {
    const { result } = renderHook(() => useGameHistory());
    const { history, moves } = buildScenario();
    const sendCommand = jest.fn();

    // Jump to index 3 (after Nf3, before Nc6)
    act(() => {
      result.current.jumpToMove(3, history, moves, sendCommand);
    });

    expect(result.current.historyPointer).toBe(3);
    expect(result.current.fen).toBe(history[3]);

    // lastMove should be reconstructed: Nf3 (moves[2])
    expect(result.current.lastMove).toEqual(
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) })
    );

    // Verify the last move is actually Nf3
    const tempGame = new Chess(history[2]); // position before Nf3
    const moveObj = tempGame.move('Nf3', { sloppy: true });
    expect(result.current.lastMove).toEqual({ from: moveObj.from, to: moveObj.to });

    expect(sendCommand).toHaveBeenCalledWith('ucinewgame');
    expect(sendCommand).toHaveBeenCalledWith(`position fen ${history[3]}`);
  });

  test('jumps to the last position and reconstructs lastMove', () => {
    const { result } = renderHook(() => useGameHistory());
    const { history, moves } = buildScenario();
    const sendCommand = jest.fn();

    // Jump to the last position (index 4, after Nc6)
    act(() => {
      result.current.jumpToMove(4, history, moves, sendCommand);
    });

    expect(result.current.historyPointer).toBe(4);
    expect(result.current.fen).toBe(history[4]);

    // lastMove should be Nc6 (moves[3])
    const tempGame = new Chess(history[3]);
    const moveObj = tempGame.move('Nc6', { sloppy: true });
    expect(result.current.lastMove).toEqual({ from: moveObj.from, to: moveObj.to });
  });

  test('sets lastMove to null when jumping to position 0', () => {
    const { result } = renderHook(() => useGameHistory());
    const { history, moves } = buildScenario();
    const sendCommand = jest.fn();

    // First jump to middle
    act(() => {
      result.current.jumpToMove(2, history, moves, sendCommand);
    });
    expect(result.current.lastMove).not.toBeNull();

    // Then jump back to start
    act(() => {
      result.current.jumpToMove(0, history, moves, sendCommand);
    });
    expect(result.current.historyPointer).toBe(0);
    expect(result.current.lastMove).toBeNull();
  });

  test('updates game state correctly so the board reflects the position', () => {
    const { result } = renderHook(() => useGameHistory());
    const { history, moves } = buildScenario();
    const sendCommand = jest.fn();

    act(() => {
      result.current.jumpToMove(2, history, moves, sendCommand);
    });

    // The game object should be at the correct position
    const expectedGame = new Chess(history[2]);
    expect(result.current.game.fen()).toBe(expectedGame.fen());
    expect(result.current.game.turn()).toBe('w'); // After 1.e4 e5 (2 half-moves), it's White's turn
  });

  test('can cycle through multiple positions sequentially', () => {
    const { result } = renderHook(() => useGameHistory());
    const { history, moves } = buildScenario();
    const sendCommand = jest.fn();

    // Jump forward in sequence: 0 → 2 → 4 → 1
    act(() => { result.current.jumpToMove(0, history, moves, sendCommand); });
    expect(result.current.historyPointer).toBe(0);
    expect(result.current.game.fen()).toBe(history[0]);

    act(() => { result.current.jumpToMove(2, history, moves, sendCommand); });
    expect(result.current.historyPointer).toBe(2);
    expect(result.current.game.fen()).toBe(history[2]);

    act(() => { result.current.jumpToMove(4, history, moves, sendCommand); });
    expect(result.current.historyPointer).toBe(4);
    expect(result.current.game.fen()).toBe(history[4]);

    act(() => { result.current.jumpToMove(1, history, moves, sendCommand); });
    expect(result.current.historyPointer).toBe(1);
    expect(result.current.game.fen()).toBe(history[1]);
  });

  test('handles empty moves array when targetPointer > 0 but no moves recorded', () => {
    // Edge case: history exists but moves array is empty
    const { result } = renderHook(() => useGameHistory());
    const history = [new Chess().fen(), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'];
    const sendCommand = jest.fn();

    act(() => {
      result.current.jumpToMove(1, history, [], sendCommand);
    });

    expect(result.current.historyPointer).toBe(1);
    expect(result.current.lastMove).toBeNull(); // No moves to reconstruct from
  });

  test('jumpToMove and undo produce compatible states', () => {
    const { result } = renderHook(() => useGameHistory());
    const { history, moves } = buildScenario();
    const sendCommand = jest.fn();

    // Jump to middle of game (after 1.e4 e5 Nf3, index 3)
    act(() => {
      result.current.jumpToMove(3, history, moves, sendCommand);
    });
    expect(result.current.historyPointer).toBe(3);

    // Undo once from pointer 3 — should go back to pointer 2 (after 1.e4 e5)
    act(() => {
      result.current.undo(3, history, moves, sendCommand);
    });

    expect(result.current.historyPointer).toBe(2);
    expect(result.current.fen).toBe(history[2]);
  });
});
