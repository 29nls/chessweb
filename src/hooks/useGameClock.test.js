import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useGameClock } from './useGameClock';

/**
 * Creates mock refs for channel, playerId, and the onFlagFall callback
 * as passed to useGameClock.
 */
function createMocks({
  channelPresent = true,
  playerId = 'p1',
  playerColor = 'white',
  gameCode = 'ABCDEF',
  onFlagFall = jest.fn(),
} = {}) {
  const send = jest.fn();
  const channelRef = { current: channelPresent ? { send } : null };
  const playerIdRef = { current: playerId };
  return { channelRef, playerIdRef, send, playerColor, gameCode, onFlagFall };
}

// ─── Helpers ────────────────────────────────────────────

function setup(mocks = {}) {
  return renderHook(
    ({ channelRef, playerIdRef, playerColor, gameCode, onFlagFall }) =>
      useGameClock({ channelRef, playerIdRef, playerColor, gameCode, onFlagFall }),
    { initialProps: createMocks(mocks) }
  );
}

// ── useGameClock tests ──────────────────────────────────

describe('useGameClock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Initial state ───────────────────────────────────

  describe('initial state', () => {
    test('timeControlMs, whiteTime, blackTime start at 0', () => {
      const { result } = setup();
      expect(result.current.timeControlMs).toBe(0);
      expect(result.current.whiteTime).toBe(0);
      expect(result.current.blackTime).toBe(0);
    });

    test('onClockSyncRef starts null', () => {
      const { result } = setup();
      expect(result.current.onClockSyncRef.current).toBeNull();
    });
  });

  // ── setTimeControl ──────────────────────────────────

  describe('setTimeControl', () => {
    test('sets timeControlMs and both clock times', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(300000); }); // 5 min
      expect(result.current.timeControlMs).toBe(300000);
      expect(result.current.whiteTime).toBe(300000);
      expect(result.current.blackTime).toBe(300000);
    });

    test('sets timeControlMs=0 but leaves clock times at 0 (untimed)', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(0); });
      expect(result.current.timeControlMs).toBe(0);
      expect(result.current.whiteTime).toBe(0);
      expect(result.current.blackTime).toBe(0);
    });
  });

  // ── setClockTimesFromSync ───────────────────────────

  describe('setClockTimesFromSync', () => {
    test('updates both clock times directly', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(300000); });
      act(() => { result.current.setClockTimesFromSync(280000, 290000); });
      expect(result.current.whiteTime).toBe(280000);
      expect(result.current.blackTime).toBe(290000);
    });
  });

  // ── startClock / stopClock ──────────────────────────

  describe('startClock', () => {
    test('does nothing when timeControlMs is 0 (untimed)', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(0); });
      act(() => { result.current.startClock('white'); });
      // No error, no interval — just a no-op
    });

    test('starts ticking and decrements active color time', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(10000); }); // 10s
      act(() => { result.current.startClock('white'); });

      // Advance 5 ticks (500ms)
      act(() => { jest.advanceTimersByTime(500); });

      expect(result.current.whiteTime).toBeLessThan(10000);
      expect(result.current.whiteTime).toBe(9500); // 5 ticks × 100ms
      expect(result.current.blackTime).toBe(10000); // unchanged
    });

    test('only decrements the active color', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(10000); });
      act(() => { result.current.startClock('black'); });

      act(() => { jest.advanceTimersByTime(300); });

      expect(result.current.whiteTime).toBe(10000); // unchanged
      expect(result.current.blackTime).toBe(9700); // 3 ticks × 100ms
    });

    test('clears previous interval before starting a new one', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(10000); });
      act(() => { result.current.startClock('white'); });
      act(() => { jest.advanceTimersByTime(200); });
      // Switch active color
      act(() => { result.current.startClock('black'); });
      act(() => { jest.advanceTimersByTime(100); });

      // Both decremented once — white from first period, black from second
      expect(result.current.whiteTime).toBe(9800); // dropped 200
      expect(result.current.blackTime).toBe(9900); // dropped 100
    });
  });

  describe('stopClock', () => {
    test('stops ticking', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(10000); });
      act(() => { result.current.startClock('white'); });
      act(() => { jest.advanceTimersByTime(300); });

      act(() => { result.current.stopClock(); });

      const frozenWhite = result.current.whiteTime;
      act(() => { jest.advanceTimersByTime(500); });
      expect(result.current.whiteTime).toBe(frozenWhite); // unchanged after stop
    });
  });

  // ── Flag fall ──────────────────────────────────────

  describe('flag fall', () => {
    test('calls onFlagFall when white time expires', () => {
      const onFlagFall = jest.fn();
      const { result } = setup({ onFlagFall });

      act(() => { result.current.setTimeControl(500); }); // 0.5s
      act(() => { result.current.startClock('white'); });

      // Tick beyond expiry — 6 ticks × 100ms = 600ms > 500ms
      act(() => { jest.advanceTimersByTime(600); });

      expect(onFlagFall).toHaveBeenCalledWith('white');
      expect(result.current.whiteTime).toBe(0);
    });

    test('calls onFlagFall when black time expires', () => {
      const onFlagFall = jest.fn();
      const { result } = setup({ onFlagFall });

      act(() => { result.current.setTimeControl(500); });
      act(() => { result.current.startClock('black'); });

      act(() => { jest.advanceTimersByTime(600); });

      expect(onFlagFall).toHaveBeenCalledWith('black');
      expect(result.current.blackTime).toBe(0);
    });

    test('calls onFlagFall only once (idempotent)', () => {
      const onFlagFall = jest.fn();
      const { result } = setup({ onFlagFall });

      act(() => { result.current.setTimeControl(300); });
      act(() => { result.current.startClock('white'); });

      // Tick well past expiry
      act(() => { jest.advanceTimersByTime(1000); });

      expect(onFlagFall).toHaveBeenCalledTimes(1);
    });

    test('stops clock after flag fall', () => {
      const onFlagFall = jest.fn();
      const { result } = setup({ onFlagFall });

      act(() => { result.current.setTimeControl(300); });
      act(() => { result.current.startClock('white'); });
      act(() => { jest.advanceTimersByTime(400); });

      // After flag fall, time should not continue decrementing
      const frozenWhite = result.current.whiteTime;
      act(() => { jest.advanceTimersByTime(500); });
      expect(result.current.whiteTime).toBe(frozenWhite);
    });
  });

  // ── sendClockSync ──────────────────────────────────

  describe('sendClockSync', () => {
    test('broadcasts clock_sync via channel with explicit args', () => {
      const mocks = createMocks();
      const { result } = renderHook(
        (props) => useGameClock(props),
        { initialProps: mocks }
      );

      act(() => { result.current.setTimeControl(300000); });
      act(() => { result.current.sendClockSync(250000, 240000, 'white'); });

      expect(mocks.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'clock_sync',
        payload: {
          whiteTime: 250000,
          blackTime: 240000,
          activeColor: 'white',
          playerId: 'p1',
        },
      });
    });

    test('falls back to internal refs when args are omitted', () => {
      const mocks = createMocks();
      const { result } = renderHook(
        (props) => useGameClock(props),
        { initialProps: mocks }
      );

      act(() => { result.current.setTimeControl(300000); });
      act(() => { result.current.startClock('white'); });
      act(() => { jest.advanceTimersByTime(200); });

      // sendClockSync with no args should read from internal refs.
      // After 2 ticks (200ms), whiteTime = 300000 - 200 = 299800.
      act(() => { result.current.sendClockSync(); });

      expect(mocks.send).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            whiteTime: 299800,
            blackTime: 300000,
          }),
        })
      );
    });

    test('does nothing when channel is null', () => {
      const mocks = createMocks({ channelPresent: false });
      const { result } = renderHook(
        ({ channelRef, playerIdRef, playerColor, gameCode, onFlagFall }) =>
          useGameClock({ channelRef, playerIdRef, playerColor, gameCode, onFlagFall }),
        { initialProps: mocks }
      );

      act(() => { result.current.sendClockSync(1000, 1000, 'white'); });

      expect(mocks.send).not.toHaveBeenCalled();
    });
  });

  // ── registerOnClockSync ────────────────────────────

  describe('registerOnClockSync', () => {
    test('registers and invokes callback via ref', () => {
      const { result } = setup();
      const cb = jest.fn();

      act(() => { result.current.registerOnClockSync(cb); });
      act(() => { result.current.onClockSyncRef.current(5000, 4000, 'white'); });

      expect(cb).toHaveBeenCalledWith(5000, 4000, 'white');
    });

    test('starts null before registration', () => {
      const { result } = setup();
      expect(result.current.onClockSyncRef.current).toBeNull();
    });
  });

  // ── resetClockState ────────────────────────────────

  describe('resetClockState', () => {
    test('stops the running clock interval', () => {
      const { result } = setup();

      act(() => { result.current.setTimeControl(10000); });
      act(() => { result.current.startClock('white'); });
      act(() => { jest.advanceTimersByTime(200); });

      act(() => { result.current.resetClockState(); });

      const frozen = result.current.whiteTime;
      act(() => { jest.advanceTimersByTime(500); });
      expect(result.current.whiteTime).toBe(frozen);
    });

    test('is safe to call when no clock is running', () => {
      const { result } = setup();
      // Should not throw
      act(() => { result.current.resetClockState(); });
    });
  });

  // ── tickClock (manual) ─────────────────────────────

  describe('tickClock (manual invocation)', () => {
    test('decrements active color time by 100ms per call', () => {
      const { result } = setup();

      act(() => { result.current.setTimeControl(10000); });
      // Start + immediately stop the interval so we can call tickClock manually,
      // but preserve activeClockColorRef (set by startClock before interval fires).
      act(() => { result.current.startClock('white'); });
      // resetClockState clears the interval but does NOT clear activeClockColorRef.
      // Actually it does... let me use a different approach: start the clock to
      // set the active color, THEN manually call tickClock before the interval fires.
      // Since jest.useFakeTimers() is active, the interval won't fire until we
      // advance time. So we can call tickClock() right after startClock().
      act(() => { result.current.tickClock(); });

      // After 1 manual tick, whiteTime should have decreased by 100ms
      expect(result.current.whiteTime).toBe(9900);
      expect(result.current.blackTime).toBe(10000); // unchanged
    });

    test('does nothing when no active color', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(10000); });
      // No startClock — no active color

      act(() => { result.current.tickClock(); });

      expect(result.current.whiteTime).toBe(10000);
      expect(result.current.blackTime).toBe(10000);
    });

    test('does nothing when timeControlMs is 0', () => {
      const { result } = setup();
      act(() => { result.current.setTimeControl(0); });
      act(() => { result.current.startClock('white'); }); // no-op for untimed

      act(() => { result.current.tickClock(); });

      expect(result.current.whiteTime).toBe(0);
      expect(result.current.blackTime).toBe(0);
    });
  });

  // ── onFlagFall ref stability ───────────────────────

  describe('onFlagFall ref pattern', () => {
    test('uses latest onFlagFall even when callback reference changes', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      const { result, rerender } = renderHook(
        (props) => useGameClock(props),
        { initialProps: createMocks({ onFlagFall: cb1 }) }
      );

      act(() => { result.current.setTimeControl(300); });
      act(() => { result.current.startClock('white'); });

      // Change the callback mid-game
      rerender(createMocks({ onFlagFall: cb2 }));

      act(() => { jest.advanceTimersByTime(400); });

      // cb1 should NOT be called — cb2 is the latest
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledWith('white');
    });
  });
});
