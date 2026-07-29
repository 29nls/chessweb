import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useGameClock — Encapsulates chess clock state, tick logic, flag-fall detection,
 * clock-sync broadcasting, and drift correction. Extracted from useOnlineGame.
 *
 * @param {Object} params
 * @param {React.MutableRefObject} params.channelRef - Supabase Realtime channel ref
 * @param {React.MutableRefObject<string>} params.playerIdRef - Player ID ref
 * @param {string} params.playerColor - 'white' | 'black' | 'spectator'
 * @param {string} params.gameCode - Current game invite code
 * @param {Function} params.onFlagFall - Called with loserColor when a flag falls.
 *   Expected to broadcast game_over and update gameStatus.
 * @returns {Object} clock state and actions
 */
export function useGameClock({ channelRef, playerIdRef, playerColor, gameCode, onFlagFall }) {
  const [timeControlMs, setTimeControlMs] = useState(0);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);

  const whiteTimeRef = useRef(0);
  const blackTimeRef = useRef(0);
  const activeClockColorRef = useRef(null);
  const clockIntervalRef = useRef(null);
  const clockGameCodeRef = useRef('');
  const isClockRunningRef = useRef(false);
  const timeControlMsRef = useRef(0);

  // Callback ref for incoming clock sync events
  const onClockSyncRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { clockGameCodeRef.current = gameCode; }, [gameCode]);
  useEffect(() => { timeControlMsRef.current = timeControlMs; }, [timeControlMs]);

  // Use a ref for onFlagFall so handleFlagFall/tickClock remain stable.
  // Without this, a change to onFlagFall would create a new tickClock but
  // the running setInterval would still reference the old one (stale closure).
  const onFlagFallRef = useRef(onFlagFall);
  useEffect(() => { onFlagFallRef.current = onFlagFall; }, [onFlagFall]);

  const sendClockSync = useCallback((wt, bt, activeColor) => {
    if (channelRef.current) {
      const wTime = wt != null ? wt : whiteTimeRef.current;
      const bTime = bt != null ? bt : blackTimeRef.current;
      const active = activeColor || activeClockColorRef.current;
      channelRef.current.send({
        type: 'broadcast',
        event: 'clock_sync',
        payload: { whiteTime: wTime, blackTime: bTime, activeColor: active, playerId: playerIdRef.current },
      });
    }
  }, [channelRef, playerIdRef]);

  const handleFlagFall = useCallback((loserColor) => {
    if (!clockIntervalRef.current) return;
    clearInterval(clockIntervalRef.current);
    clockIntervalRef.current = null;
    activeClockColorRef.current = null;
    isClockRunningRef.current = false;
    onFlagFallRef.current(loserColor);
  }, []);

  const tickClock = useCallback(() => {
    const active = activeClockColorRef.current;
    const maxMs = timeControlMsRef.current;
    if (!active || maxMs <= 0) return;

    const newWt = active === 'white' ? Math.max(0, whiteTimeRef.current - 100) : whiteTimeRef.current;
    const newBt = active === 'black' ? Math.max(0, blackTimeRef.current - 100) : blackTimeRef.current;

    whiteTimeRef.current = newWt;
    blackTimeRef.current = newBt;
    setWhiteTime(newWt);
    setBlackTime(newBt);

    if (newWt <= 0) {
      handleFlagFall('white');
    } else if (newBt <= 0) {
      handleFlagFall('black');
    }
  }, [handleFlagFall]);

  const startClock = useCallback((activeColor) => {
    const maxMs = timeControlMsRef.current;
    if (maxMs <= 0) return;
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
    }
    activeClockColorRef.current = activeColor;
    isClockRunningRef.current = true;
    clockIntervalRef.current = setInterval(tickClock, 100);
  }, [tickClock]);

  const stopClock = useCallback(() => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    activeClockColorRef.current = null;
    isClockRunningRef.current = false;
  }, []);

  const setTimeControl = useCallback((initialMs) => {
    setTimeControlMs(initialMs);
    timeControlMsRef.current = initialMs;
    if (initialMs > 0) {
      whiteTimeRef.current = initialMs;
      blackTimeRef.current = initialMs;
      setWhiteTime(initialMs);
      setBlackTime(initialMs);
    }
  }, []);

  const setClockTimesFromSync = useCallback((wt, bt) => {
    whiteTimeRef.current = wt;
    blackTimeRef.current = bt;
    setWhiteTime(wt);
    setBlackTime(bt);
  }, []);

  const registerOnClockSync = useCallback((callback) => {
    onClockSyncRef.current = callback;
  }, []);

  // Expose flag-fall gate access for cleanup from parent
  const resetClockState = useCallback(() => {
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    activeClockColorRef.current = null;
    isClockRunningRef.current = false;
  }, []);

  return {
    // State
    timeControlMs,
    whiteTime,
    blackTime,
    // Actions
    startClock,
    stopClock,
    tickClock,
    sendClockSync,
    setTimeControl,
    setClockTimesFromSync,
    // Callback registration
    registerOnClockSync,
    onClockSyncRef,
    // Cleanup from parent
    resetClockState,
    // Refs (for channel event handler registration in parent)
    activeClockColorRef,
  };
}
