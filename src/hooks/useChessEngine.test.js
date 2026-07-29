import { renderHook, act, cleanup } from '@testing-library/react';
import { normalizeEvaluationToWhite, useChessEngine } from './useChessEngine';

// ══════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════

// CRITICAL: CRA Jest preset uses resetMocks: true, so EVERY jest.fn()
// is wiped before each test. All implementations MUST be re-established
// in beforeEach().

let onOutputCb = null;   // captured by mockEngine.onOutput
let onConnectCb = null;  // captured by mockEngine.onConnect
let engineCallCount = 0; // tracks how many times createEngine was called
let engineMock = null;   // the last mock engine returned by createEngine

jest.mock('../engine', () => ({
  createEngine: jest.fn(),
}));

jest.mock('chess.js', () => ({
  Chess: jest.fn(),
}));

import { createEngine } from '../engine';
import { Chess } from 'chess.js';

// ── helpers ───────────────────────────────────────────

function buildEngineMock() {
  let searchIdCounter = 0;
  let currentSearchId = null;

  return {
    onOutput: jest.fn((cb) => {
      onOutputCb = cb;
      return () => { onOutputCb = null; };
    }),
    onConnect: jest.fn((cb) => {
      onConnectCb = cb;
    }),
    sendCommand: jest.fn((cmd) => {
      if (/^\s*go\b/i.test(cmd)) {
        currentSearchId = ++searchIdCounter;
      }
      return currentSearchId;
    }),
    getCurrentSearchId: () => currentSearchId,
    disconnect: jest.fn(() => {
      onOutputCb = null;
      onConnectCb = null;
    }),
  };
}

beforeEach(() => {
  onOutputCb = null;
  onConnectCb = null;
  engineCallCount = 0;

  // Re-establish createEngine mock (wiped by resetMocks: true)
  createEngine.mockImplementation(() => {
    engineCallCount++;
    engineMock = buildEngineMock();
    return engineMock;
  });

  // Re-establish Chess constructor mock
  Chess.mockImplementation(() => ({
    move: jest.fn(() => ({ from: 'e2', to: 'e4', san: 'e4' })),
    fen: () => 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
  }));
});

afterEach(() => {
  cleanup();
  onOutputCb = null;
  onConnectCb = null;
  engineMock = null;
});

// ═══════════════════════════════════════════════════════════
// normalizeEvaluationToWhite
// ═══════════════════════════════════════════════════════════

describe('normalizeEvaluationToWhite', () => {
  test('keeps White-to-move score', () => {
    expect(normalizeEvaluationToWhite({ value: 3, type: 'mate' }, 'w'))
      .toEqual({ value: 3, type: 'mate' });
  });
  test('reverses Black-to-move score', () => {
    expect(normalizeEvaluationToWhite({ value: 3, type: 'mate' }, 'b'))
      .toEqual({ value: -3, type: 'mate' });
  });
});

// ═══════════════════════════════════════════════════════════
// STALE CLOSURE & RACE CONDITION FIX
// ═══════════════════════════════════════════════════════════

describe('useChessEngine', () => {

  /** Start a search, emit one info line, then the bestmove */
  function emitBestmove(result, move) {
    if (!onOutputCb) throw new Error('no output handler registered');
    act(() => { result.current.sendCommand('go depth 12'); });
    const searchId = engineMock.getCurrentSearchId();
    act(() => { onOutputCb({ type: 'info', searchId, score: { type: 'cp', value: 30 }, depth: 12, pv: [move], multipv: 1 }); });
    act(() => { onOutputCb({ type: 'bestmove', searchId, move }); });
  }

  /** Simulate engine readiness */
  function connectEngine() {
    if (!onConnectCb) throw new Error('no connect handler registered');
    act(() => { onConnectCb(); });
  }

  test('initial onBestMove called on bestmove event', () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: cb, multiPv: 1 }));
    connectEngine();
    emitBestmove(result, 'e2e4');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ fen: expect.any(Function) }),
      { from: 'e2', to: 'e4', san: 'e4' },
    );
  });

  test('updated onBestMove is used after prop change (not stale one)', () => {
    const oldCb = jest.fn();
    const newCb = jest.fn();
    const { result, rerender } = renderHook(
      (p) => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: p?.cb || oldCb, multiPv: 1 }),
      { initialProps: { cb: oldCb } },
    );
    connectEngine();
    act(() => { rerender({ cb: newCb }); });
    emitBestmove(result, 'e2e4');
    expect(newCb).toHaveBeenCalledTimes(1);
    expect(oldCb).not.toHaveBeenCalled();
  });

  test('only latest callback fires after multiple updates', () => {
    const cbs = [jest.fn(), jest.fn(), jest.fn()];
    const { result, rerender } = renderHook(
      (p) => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: p?.cb || cbs[0], multiPv: 1 }),
      { initialProps: { cb: cbs[0] } },
    );
    connectEngine();
    act(() => { rerender({ cb: cbs[1] }); });
    act(() => { rerender({ cb: cbs[2] }); });
    emitBestmove(result, 'e2e4');
    expect(cbs[2]).toHaveBeenCalledTimes(1);
    expect(cbs[0]).not.toHaveBeenCalled();
    expect(cbs[1]).not.toHaveBeenCalled();
  });

  test('undefined onBestMove does not throw', () => {
    const { result } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: undefined, multiPv: 1 }));
    connectEngine();
    expect(() => emitBestmove(result, 'e2e4')).not.toThrow();
  });

  test('null onBestMove does not throw', () => {
    const { result } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: null, multiPv: 1 }));
    connectEngine();
    expect(() => emitBestmove(result, 'e2e4')).not.toThrow();
  });

  test('receives correct game and move', () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: cb, multiPv: 1 }));
    connectEngine();
    emitBestmove(result, 'e2e4');
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ fen: expect.any(Function), move: expect.any(Function) }),
      expect.objectContaining({ from: 'e2', to: 'e4', san: 'e4' }),
    );
  });

  test('invalid bestmove (chess.js throws) is caught silently', () => {
    const cb = jest.fn();
    // Make chess.js move() throw on the first call
    Chess.mockImplementation(() => ({
      move: jest.fn(() => { throw new Error('invalid'); }),
      fen: () => '...',
    }));
    const { result } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: cb, multiPv: 1 }));
    connectEngine();
    expect(() => emitBestmove(result, 'badmove')).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });

  test('ignores stale info and bestmove from a superseded search', () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: cb, multiPv: 1 }));
    connectEngine();

    // Start search 1, then a new search before bestmove 1 arrives.
    act(() => { result.current.sendCommand('go depth 12'); });
    const staleSearchId = engineMock.getCurrentSearchId();
    // Start search 2 (supersedes search 1).
    act(() => { result.current.sendCommand('go depth 12'); });
    const currentSearchId = engineMock.getCurrentSearchId();

    // Emit info and bestmove for search 1 (stale)
    act(() => { onOutputCb({ type: 'info', searchId: staleSearchId, score: { type: 'cp', value: 50 }, depth: 12, pv: ['e2e4'], multipv: 1 }); });
    act(() => { onOutputCb({ type: 'bestmove', searchId: staleSearchId, move: 'e2e4' }); });

    // The eval shouldn't be updated with search 1's info, and bestmove shouldn't be triggered
    expect(cb).not.toHaveBeenCalled();
    expect(result.current.stockfishEval.score).toBeNull();

    // However, if we now emit info + bestmove for search 2, it should work
    act(() => { onOutputCb({ type: 'info', searchId: currentSearchId, score: { type: 'cp', value: 100 }, depth: 12, pv: ['d2d4'], multipv: 1 }); });
    act(() => { onOutputCb({ type: 'bestmove', searchId: currentSearchId, move: 'd2d4' }); });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(result.current.stockfishEval.score).toBe(100);
  });

  test('classifies the first info after a classification search', () => {
    const { result } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', multiPv: 1 }));
    connectEngine();

    act(() => { result.current.prepareClassification('w'); });
    act(() => { result.current.sendCommand('go depth 12'); });
    act(() => { onOutputCb({ type: 'info', score: { type: 'cp', value: 30 }, depth: 12, pv: ['e2e4'], multipv: 1 }); });

    expect(result.current.moveClassifications.length).toBe(1);
    expect(result.current.moveClassifications[0].label).toBeTruthy();
  });

  test('does not classify from a superseded classification search', () => {
    const { result } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', multiPv: 1 }));
    connectEngine();

    act(() => { result.current.prepareClassification('w'); });
    act(() => { result.current.sendCommand('go depth 12'); });
    const staleSearchId = engineMock.getCurrentSearchId();
    // A new search supersedes the first before any output arrives.
    act(() => { result.current.sendCommand('go depth 12'); });
    // This info belongs to the first (stale) search and should be ignored.
    act(() => { onOutputCb({ type: 'info', searchId: staleSearchId, score: { type: 'cp', value: 30 }, depth: 12, pv: ['e2e4'], multipv: 1 }); });

    expect(result.current.moveClassifications.length).toBe(0);
  });

  test('ucinewgame clears the current search so stale bestmove is ignored', () => {
    const cb = jest.fn();
    const { result } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: cb, multiPv: 1 }));
    connectEngine();

    act(() => { result.current.sendCommand('go depth 12'); });
    const staleSearchId = engineMock.getCurrentSearchId();
    act(() => { result.current.sendCommand('ucinewgame'); });
    act(() => { onOutputCb({ type: 'bestmove', searchId: staleSearchId, move: 'e2e4' }); });

    expect(cb).not.toHaveBeenCalled();
  });

  test('cleanup stops the engine and disconnects', () => {
    const { result, unmount } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', multiPv: 1 }));
    connectEngine();

    act(() => { result.current.sendCommand('go depth 12'); });
    unmount();

    expect(engineMock.sendCommand).toHaveBeenCalledWith('stop');
    expect(engineMock.sendCommand).toHaveBeenCalledWith('ucinewgame');
    expect(engineMock.disconnect).toHaveBeenCalled();
  });

  describe('page unload cleanup', () => {
    let addEventListenerSpy;
    let removeEventListenerSpy;
    let registeredListeners;

    beforeEach(() => {
      registeredListeners = {};

      addEventListenerSpy = jest.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
        registeredListeners[event] = handler;
      });
      removeEventListenerSpy = jest.spyOn(window, 'removeEventListener').mockImplementation((event) => {
        delete registeredListeners[event];
      });
    });

    afterEach(() => {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    test('registers beforeunload and pagehide listeners on mount', () => {
      renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', multiPv: 1 }));

      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
    });

    test('removes beforeunload and pagehide listeners on unmount', () => {
      const { unmount } = renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', multiPv: 1 }));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
    });

    test('triggers engine cleanup when beforeunload fires', () => {
      renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', multiPv: 1 }));

      act(() => {
        const handler = registeredListeners.beforeunload;
        if (handler) handler(new Event('beforeunload'));
      });

      expect(engineMock.sendCommand).toHaveBeenCalledWith('stop');
      expect(engineMock.sendCommand).toHaveBeenCalledWith('ucinewgame');
      expect(engineMock.disconnect).toHaveBeenCalled();
    });

    test('triggers engine cleanup when pagehide fires', () => {
      renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', multiPv: 1 }));

      act(() => {
        const handler = registeredListeners.pagehide;
        if (handler) handler(new Event('pagehide'));
      });

      expect(engineMock.sendCommand).toHaveBeenCalledWith('stop');
      expect(engineMock.sendCommand).toHaveBeenCalledWith('ucinewgame');
      expect(engineMock.disconnect).toHaveBeenCalled();
    });
  });
});
