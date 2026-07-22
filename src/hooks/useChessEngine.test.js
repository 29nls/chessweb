import { renderHook, act, cleanup } from '@testing-library/react';
import { normalizeEvaluationToWhite, useChessEngine } from './useChessEngine';

// ═══════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════

// CRITICAL: CRA Jest preset uses resetMocks: true, so EVERY jest.fn()
// is wiped before each test. All implementations MUST be re-established
// in beforeEach().

let onOutputCb = null;   // captured by mockEngine.onOutput
let onConnectCb = null;  // captured by mockEngine.onConnect
let engineCallCount = 0; // tracks how many times createEngine was called

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
  return {
    onOutput: jest.fn((cb) => {
      onOutputCb = cb;
      return () => { onOutputCb = null; };
    }),
    onConnect: jest.fn((cb) => {
      onConnectCb = cb;
    }),
    sendCommand: jest.fn(),
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
    return buildEngineMock();
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
// STALE CLOSURE FIX
// ═══════════════════════════════════════════════════════════

describe('useChessEngine — onBestMove stale closure fix', () => {

  /** Emit 'bestmove' + preceding 'info' through the output handler */
  function emitBestmove(move) {
    if (!onOutputCb) throw new Error('no output handler registered');
    // Send info first (classification setup), then bestmove
    act(() => { onOutputCb({ type: 'info', score: { type: 'cp', value: 30 }, depth: 12, pv: [move], multipv: 1 }); });
    act(() => { onOutputCb({ type: 'bestmove', move }); });
  }

  /** Simulate engine readiness */
  function connectEngine() {
    if (!onConnectCb) throw new Error('no connect handler registered');
    act(() => { onConnectCb(); });
  }

  test('initial onBestMove called on bestmove event', () => {
    const cb = jest.fn();
    renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: cb, multiPv: 1 }));
    connectEngine();
    emitBestmove('e2e4');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ fen: expect.any(Function) }),
      { from: 'e2', to: 'e4', san: 'e4' },
    );
  });

  test('updated onBestMove is used after prop change (not stale one)', () => {
    const oldCb = jest.fn();
    const newCb = jest.fn();
    const { rerender } = renderHook(
      (p) => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: p?.cb || oldCb, multiPv: 1 }),
      { initialProps: { cb: oldCb } },
    );
    connectEngine();
    act(() => { rerender({ cb: newCb }); });
    emitBestmove('e2e4');
    expect(newCb).toHaveBeenCalledTimes(1);
    expect(oldCb).not.toHaveBeenCalled();
  });

  test('only latest callback fires after multiple updates', () => {
    const cbs = [jest.fn(), jest.fn(), jest.fn()];
    const { rerender } = renderHook(
      (p) => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: p?.cb || cbs[0], multiPv: 1 }),
      { initialProps: { cb: cbs[0] } },
    );
    connectEngine();
    act(() => { rerender({ cb: cbs[1] }); });
    act(() => { rerender({ cb: cbs[2] }); });
    emitBestmove('e2e4');
    expect(cbs[2]).toHaveBeenCalledTimes(1);
    expect(cbs[0]).not.toHaveBeenCalled();
    expect(cbs[1]).not.toHaveBeenCalled();
  });

  test('undefined onBestMove does not throw', () => {
    renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: undefined, multiPv: 1 }));
    connectEngine();
    expect(() => emitBestmove('e2e4')).not.toThrow();
  });

  test('null onBestMove does not throw', () => {
    renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: null, multiPv: 1 }));
    connectEngine();
    expect(() => emitBestmove('e2e4')).not.toThrow();
  });

  test('receives correct game and move', () => {
    const cb = jest.fn();
    renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: cb, multiPv: 1 }));
    connectEngine();
    emitBestmove('e2e4');
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
    renderHook(() => useChessEngine({ threads: 1, hashSize: 64, fen: 'start', onBestMove: cb, multiPv: 1 }));
    connectEngine();
    expect(() => emitBestmove('badmove')).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });
});
