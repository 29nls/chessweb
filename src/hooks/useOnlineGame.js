import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { parseSupabaseError, logSupabaseError } from '../lib/supabaseErrors';
import { useGameClock } from './useGameClock';
import { useChat } from './useChat';
import {
  generateCode,
  getPlayerId,
  saveGameState,
  clearGameState,
  getSavedGameState,
  TIME_CONTROL_PRESETS,
} from '../lib/onlineGameUtils';

// Re-export for backward compatibility
export { TIME_CONTROL_PRESETS };

// ─── Main hook ──────────────────────────────────────────

export function useOnlineGame() {
  // Core game state
  const [gameStatus, setGameStatus] = useState('idle');
  const [gameCode, setGameCode] = useState('');
  const [playerColor, setPlayerColor] = useState(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [error, setError] = useState(null);
  const [spectatorCount, setSpectatorCount] = useState(0);

  // Shared infrastructure refs
  const channelRef = useRef(null);
  const lobbyChannelRef = useRef(null);
  const playerIdRef = useRef(getPlayerId());

  // Game callback refs
  const onMoveReceivedRef = useRef(null);
  const onGameStartRef = useRef(null);
  const onStateRequestedRef = useRef(null);
  const onSyncStateReceivedRef = useRef(null);
  const onTakebackRequestedRef = useRef(null);
  const onTakebackRespondedRef = useRef(null);
  const onDrawOfferedRef = useRef(null);
  const onDrawRespondedRef = useRef(null);

  // Player color ref (used in clock callbacks and saveGameState)
  const playerColorRef = useRef(playerColor);
  useEffect(() => { playerColorRef.current = playerColor; }, [playerColor]);

  // ─── Flag fall handler (wired to useGameClock) ────────
  const handleFlagFall = useCallback((loserColor) => {
    const winner = loserColor === 'white' ? 'black' : 'white';
    setGameResult({ winner, reason: 'Time forfeit' });
    setGameStatus('finished');
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast', event: 'game_over',
        payload: { winner, reason: 'Time forfeit', playerId: playerIdRef.current },
      });
    }
    if (gameCode) saveGameState(gameCode, playerColorRef.current, 'finished');
  }, [gameCode]);

  // ─── Composed hooks ───────────────────────────────────

  const clock = useGameClock({
    channelRef,
    playerIdRef,
    playerColor,
    gameCode,
    onFlagFall: handleFlagFall,
  });

  const chat = useChat({
    channelRef,
    playerIdRef,
    playerColor,
  });

  // Extract stable identities from composed hooks so callbacks
  // that reference them don't depend on chat/clock objects (which
  // change every render), keeping useMemo effective.
  const chatMessageRef = chat.onChatMessageRef;
  const chatReactionRef = chat.onReactionRef;
  const clockSyncRef = clock.onClockSyncRef;
  const clearChatRefs = chat.clearChatRefs;
  const resetClockState = clock.resetClockState;
  const setTimeControlFn = clock.setTimeControl;

  // ─── Cleanup ──────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (lobbyChannelRef.current) {
      supabase.removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }
    // Clear all callback refs
    onMoveReceivedRef.current = null;
    onGameStartRef.current = null;
    onStateRequestedRef.current = null;
    onSyncStateReceivedRef.current = null;
    onTakebackRequestedRef.current = null;
    onTakebackRespondedRef.current = null;
    onDrawOfferedRef.current = null;
    onDrawRespondedRef.current = null;
    // Clear chat refs
    clearChatRefs();
    // Stop clock
    resetClockState();
  }, [clearChatRefs, resetClockState]);

  // Update lobby presence
  const updateLobbyPresence = useCallback(async (code, status, numPlayers) => {
    if (!lobbyChannelRef.current) return;
    try {
      await lobbyChannelRef.current.track({
        isHost: true,
        gameCode: code,
        status: status,
        players: numPlayers,
        joined_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to update lobby presence:', err);
    }
  }, []);

  // ─── Channel subscription ─────────────────────────────

  const subscribeToChannel = useCallback((code, color) => {
    if (!supabase) {
      setError('Supabase not configured. Check your .env file.');
      return;
    }

    cleanup();

    if (color === 'white') {
      const lobbyChannel = supabase.channel('lobby:games');
      lobbyChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          updateLobbyPresence(code, 'waiting', 1);
        }
      });
      lobbyChannelRef.current = lobbyChannel;
    }

    const channel = supabase.channel(`game:${code}`, {
      config: {
        broadcast: { self: false },
        presence: { key: playerIdRef.current },
      },
    });

    // Move events
    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onMoveReceivedRef.current) {
        onMoveReceivedRef.current(payload);
      }
    });

    // Resign / game_over events
    channel.on('broadcast', { event: 'resign' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current) {
        const winnerColor = payload.color === 'white' ? 'black' : 'white';
        setGameResult({ winner: winnerColor, reason: `${payload.color} resigned` });
        setGameStatus('finished');
      }
    });

    channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current) {
        setGameResult({ winner: payload.winner, reason: payload.reason });
        setGameStatus('finished');
      }
    });

    // Chat & Reaction (delegated to useChat refs)
    channel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && chatMessageRef.current) {
        chatMessageRef.current(payload.text, payload.color, payload.playerId);
      }
    });

    channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && chatReactionRef.current) {
        chatReactionRef.current(payload.emoji, payload.color, payload.playerId);
      }
    });

    // Takeback events
    channel.on('broadcast', { event: 'takeback_request' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onTakebackRequestedRef.current) {
        onTakebackRequestedRef.current(payload.playerId);
      }
    });

    channel.on('broadcast', { event: 'takeback_response' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onTakebackRespondedRef.current) {
        onTakebackRespondedRef.current(payload.accepted, payload.playerId);
      }
    });

    // Clock sync (delegated to useGameClock ref)
    channel.on('broadcast', { event: 'clock_sync' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && clockSyncRef.current) {
        clockSyncRef.current(payload.whiteTime, payload.blackTime, payload.activeColor);
      }
    });

    // Draw events
    channel.on('broadcast', { event: 'draw_offer' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onDrawOfferedRef.current) {
        onDrawOfferedRef.current(payload.playerId);
      }
    });

    channel.on('broadcast', { event: 'draw_response' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onDrawRespondedRef.current) {
        onDrawRespondedRef.current(payload.accepted, payload.playerId);
      }
    });

    // Spectator state sync
    channel.on('broadcast', { event: 'request_state' }, ({ payload }) => {
      if (color === 'white' && onStateRequestedRef.current) {
        onStateRequestedRef.current(payload.spectatorId);
      } else if (color === 'black' && onStateRequestedRef.current) {
        onStateRequestedRef.current(payload.spectatorId);
      }
    });

    channel.on('broadcast', { event: 'sync_state' }, ({ payload }) => {
      if (color === 'spectator' && payload.targetId === playerIdRef.current && onSyncStateReceivedRef.current) {
        onSyncStateReceivedRef.current(payload.fen, payload.moves, payload.history);
      }
    });

    // Presence tracking
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();

      let pCount = 0;
      let sCount = 0;

      Object.values(state).forEach(presences => {
        if (presences.length > 0) {
          const p = presences[0];
          if (p.role === 'player') pCount++;
          if (p.role === 'spectator') sCount++;
        }
      });

      setSpectatorCount(sCount);
      setOpponentConnected(pCount >= 2);

      if (color === 'white') {
        updateLobbyPresence(code, pCount >= 2 ? 'playing' : 'waiting', pCount);
      }

      // Race condition detection
      let blackCount = 0;
      let whiteCount = 0;
      Object.values(state).forEach(presences => {
        presences.forEach(p => {
          if (p.role === 'player') {
            if (p.color === 'black') blackCount++;
            if (p.color === 'white') whiteCount++;
          }
        });
      });

      if (color === 'black' && blackCount > 1) {
        setError('Another player joined as Black at the same time. Please try again.');
        if (lobbyChannelRef.current) supabase.removeChannel(lobbyChannelRef.current);
        if (channelRef.current) supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        lobbyChannelRef.current = null;
        clearGameState();
        setGameStatus('idle');
        setGameCode('');
        setPlayerColor(null);
        setOpponentConnected(false);
        setSpectatorCount(0);
        return;
      }
      if (color === 'white' && whiteCount > 1) {
        setError('Another player created a game with the same code. Please try again.');
        if (lobbyChannelRef.current) supabase.removeChannel(lobbyChannelRef.current);
        if (channelRef.current) supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        lobbyChannelRef.current = null;
        clearGameState();
        setGameStatus('idle');
        setGameCode('');
        setPlayerColor(null);
        setOpponentConnected(false);
        setSpectatorCount(0);
        return;
      }

      if (pCount >= 2) {
        setGameStatus(prev => {
          if (prev === 'waiting') {
            saveGameState(code, color, 'playing');
            if (onGameStartRef.current) onGameStartRef.current();
            return 'playing';
          }
          return prev;
        });
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          player_id: playerIdRef.current,
          role: color === 'spectator' ? 'spectator' : 'player',
          color: color,
          joined_at: new Date().toISOString(),
        });

        if (color === 'spectator') {
          channel.send({
            type: 'broadcast',
            event: 'request_state',
            payload: { spectatorId: playerIdRef.current },
          });
        }
      }
    });

    channelRef.current = channel;
    // chat/clock objects omitted from deps — only stable refs (chatMessageRef,
    // chatReactionRef, clockSyncRef) are accessed, all of which are useRef returns
    // that never change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup, updateLobbyPresence]);

  // ─── Reconnect ────────────────────────────────────────

  useEffect(() => {
    const saved = getSavedGameState();
    if (saved && (saved.status === 'waiting' || saved.status === 'playing')) {
      setGameCode(saved.code);
      setPlayerColor(saved.color);
      setGameStatus(saved.status === 'playing' ? 'playing' : 'waiting');
      subscribeToChannel(saved.code, saved.color);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Game actions ─────────────────────────────────────

  const createGame = useCallback(async (timeMs) => {
    const code = generateCode();
    if (supabase) {
      try {
        const { data, error: claimError } = await supabase.rpc('claim_chess_game_slot', {
          p_game_code: code,
          p_player_id: playerIdRef.current,
          p_color: 'white',
          p_time_control_ms: timeMs || 0,
        });
        const claim = Array.isArray(data) ? data[0] : data;
        if (claimError) {
          const parsed = parseSupabaseError(claimError);
          logSupabaseError('createGame.claimError', claimError);
          setError(parsed.friendly);
          return false;
        }
        if (!claim?.claimed) {
          setError('Could not reserve a game slot. The server may be busy — please try again.');
          return false;
        }
      } catch (rawError) {
        const parsed = parseSupabaseError(rawError);
        logSupabaseError('createGame.catch', rawError);
        setError(parsed.friendly);
        return false;
      }
    }
    if (timeMs != null) {
      setTimeControlFn(timeMs);
    }
    setGameCode(code);
    setPlayerColor('white');
    setGameStatus('waiting');
    setGameResult(null);
    setError(null);
    saveGameState(code, 'white', 'waiting');
    subscribeToChannel(code, 'white');
    return code;
  }, [subscribeToChannel]);

  const checkSlotAvailability = useCallback(async (code, desiredColor) => {
    if (!supabase) return true;
    try {
      const tempChannel = supabase.channel(`game:${code}`, {
        config: { presence: { key: 'checker_' + getPlayerId() } },
      });

      return new Promise((resolve) => {
        const timeout = setTimeout(() => { tempChannel.unsubscribe(); resolve(true); }, 5000);

        tempChannel.on('presence', { event: 'sync' }, () => {
          clearTimeout(timeout);
          const state = tempChannel.presenceState();
          tempChannel.unsubscribe();

          let blackTaken = false;
          Object.values(state).forEach(presences => {
            presences.forEach(p => {
              if (p.color === 'black' && p.role === 'player') blackTaken = true;
            });
          });

          resolve(desiredColor === 'black' ? !blackTaken : true);
        });

        tempChannel.subscribe();
      });
    } catch (err) {
      console.warn('useOnlineGame: Failed to check slot availability:', err);
      return true;
    }
  }, []);

  const joinGame = useCallback(async (code) => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError('Code must be 6 characters');
      return false;
    }

    if (supabase) {
      try {
        const { data, error: claimError } = await supabase.rpc('claim_chess_game_slot', {
          p_game_code: normalized,
          p_player_id: playerIdRef.current,
          p_color: 'black',
          p_time_control_ms: 0,
        });
        const claim = Array.isArray(data) ? data[0] : data;
        if (claimError) {
          const parsed = parseSupabaseError(claimError);
          logSupabaseError('joinGame.claimError', claimError);
          setError(parsed.friendly);
          return false;
        }
        if (!claim?.claimed) {
          setError('This game already has two players. Try spectating instead.');
          return false;
        }
        setTimeControlFn(claim.time_control_ms || 0);
      } catch (rawError) {
        const parsed = parseSupabaseError(rawError);
        logSupabaseError('joinGame.catch', rawError);
        setError(parsed.friendly);
        return false;
      }
    } else {
      const slotAvailable = await checkSlotAvailability(normalized, 'black');
      if (!slotAvailable) {
        setError('This game already has two players. Try spectating instead.');
        return false;
      }
    }

    setGameCode(normalized);
    setPlayerColor('black');
    setGameStatus('waiting');
    setGameResult(null);
    setError(null);
    saveGameState(normalized, 'black', 'waiting');
    subscribeToChannel(normalized, 'black');
    return true;
  }, [subscribeToChannel, checkSlotAvailability]);

  const joinAsSpectator = useCallback((code) => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError('Invalid Game Code');
      return false;
    }
    setGameCode(normalized);
    setPlayerColor('spectator');
    setGameStatus('playing');
    setGameResult(null);
    setError(null);
    saveGameState(normalized, 'spectator', 'playing');
    subscribeToChannel(normalized, 'spectator');
    return true;
  }, [subscribeToChannel]);

  const sendMove = useCallback((moveData) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'move',
        payload: { ...moveData, playerId: playerIdRef.current },
      });
    }
  }, []);

  const sendSyncState = useCallback((targetId, fen, moves, history) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'sync_state',
        payload: { targetId, fen, moves, history },
      });
    }
  }, []);

  const resign = useCallback(() => {
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'resign',
        payload: { playerId: playerIdRef.current, color: playerColor },
      });
      const winnerColor = playerColor === 'white' ? 'black' : 'white';
      setGameResult({ winner: winnerColor, reason: 'You resigned' });
      setGameStatus('finished');
      if (gameCode) saveGameState(gameCode, playerColor, 'finished');
    }
  }, [playerColor, gameCode]);

  const broadcastGameOver = useCallback((winner, reason) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_over',
        payload: { winner, reason, playerId: playerIdRef.current },
      });
    }
    setGameResult({ winner, reason });
    setGameStatus('finished');
    if (gameCode) saveGameState(gameCode, playerColor, 'finished');
  }, [gameCode, playerColor]);

  const sendTakebackRequest = useCallback(() => {
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'takeback_request',
        payload: { playerId: playerIdRef.current, color: playerColor },
      });
    }
  }, [playerColor]);

  const sendTakebackResponse = useCallback((accepted) => {
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'takeback_response',
        payload: { playerId: playerIdRef.current, accepted },
      });
      if (accepted && onTakebackRespondedRef.current) {
        onTakebackRespondedRef.current(true, playerIdRef.current);
      }
    }
  }, [playerColor]);

  const offerDraw = useCallback(() => {
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'draw_offer',
        payload: { playerId: playerIdRef.current, color: playerColor },
      });
    }
  }, [playerColor]);

  const sendDrawResponse = useCallback((accepted) => {
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'draw_response',
        payload: { playerId: playerIdRef.current, accepted },
      });
      if (accepted) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'game_over',
          payload: { winner: 'draw', reason: 'Draw by agreement', playerId: playerIdRef.current },
        });
        setGameResult({ winner: 'draw', reason: 'Draw by agreement' });
        setGameStatus('finished');
        if (gameCode) saveGameState(gameCode, playerColor, 'finished');
      }
    }
  }, [gameCode, playerColor]);

  const leaveGame = useCallback(async () => {
    if (supabase && gameCode && playerColor !== 'spectator') {
      try {
        await supabase.rpc('release_chess_game_slot', {
          p_game_code: gameCode,
          p_player_id: playerIdRef.current,
        });
      } catch (err) {
        logSupabaseError('release_chess_game_slot', err);
      }
    }
    cleanup();
    clearGameState();
    setGameStatus('idle');
    setGameCode('');
    setPlayerColor(null);
    setOpponentConnected(false);
    setSpectatorCount(0);
    setGameResult(null);
    setError(null);
  }, [cleanup, gameCode, playerColor]);

  // ─── Callback registrations ───────────────────────────

  const registerOnMoveReceived = useCallback((cb) => { onMoveReceivedRef.current = cb; }, []);
  const registerOnGameStart = useCallback((cb) => { onGameStartRef.current = cb; }, []);
  const registerOnStateRequested = useCallback((cb) => { onStateRequestedRef.current = cb; }, []);
  const registerOnSyncStateReceived = useCallback((cb) => { onSyncStateReceivedRef.current = cb; }, []);
  const registerOnTakebackRequested = useCallback((cb) => { onTakebackRequestedRef.current = cb; }, []);
  const registerOnTakebackResponded = useCallback((cb) => { onTakebackRespondedRef.current = cb; }, []);
  const registerOnDrawOffered = useCallback((cb) => { onDrawOfferedRef.current = cb; }, []);
  const registerOnDrawResponded = useCallback((cb) => { onDrawRespondedRef.current = cb; }, []);

  // ─── Cleanup on unmount ───────────────────────────────

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // ─── Memoized return object ───────────────────────────

  return useMemo(() => ({
    // State
    gameStatus,
    gameCode,
    playerColor,
    opponentConnected,
    spectatorCount,
    gameResult,
    error,

    // Clock state (delegated)
    timeControlMs: clock.timeControlMs,
    whiteTime: clock.whiteTime,
    blackTime: clock.blackTime,

    // Clock actions (delegated)
    startClock: clock.startClock,
    stopClock: clock.stopClock,
    sendClockSync: clock.sendClockSync,
    setTimeControl: clock.setTimeControl,
    setClockTimesFromSync: clock.setClockTimesFromSync,

    // Core game actions
    createGame,
    joinGame,
    joinAsSpectator,
    sendMove,
    sendSyncState,
    resign,
    broadcastGameOver,
    leaveGame,
    sendTakebackRequest,
    sendTakebackResponse,
    offerDraw,
    sendDrawResponse,

    // Chat actions (delegated)
    sendChatMessage: chat.sendChatMessage,
    sendReaction: chat.sendReaction,

    // Callback registrations
    onMoveReceived: registerOnMoveReceived,
    onGameStart: registerOnGameStart,
    onClockSync: clock.registerOnClockSync,
    onStateRequested: registerOnStateRequested,
    onSyncStateReceived: registerOnSyncStateReceived,
    onTakebackRequested: registerOnTakebackRequested,
    onTakebackResponded: registerOnTakebackResponded,
    onDrawOffered: registerOnDrawOffered,
    onDrawResponded: registerOnDrawResponded,
    onChatMessage: chat.registerOnChatMessage,
    onReaction: chat.registerOnReaction,
  }), [
    gameStatus, gameCode, playerColor, opponentConnected,
    spectatorCount, gameResult, error,
    clock.timeControlMs, clock.whiteTime, clock.blackTime,
    clock.startClock, clock.stopClock, clock.sendClockSync,
    clock.setTimeControl, clock.setClockTimesFromSync,
    clock.registerOnClockSync,
    createGame, joinGame, joinAsSpectator, sendMove, sendSyncState,
    resign, broadcastGameOver, leaveGame,
    sendTakebackRequest, sendTakebackResponse,
    offerDraw, sendDrawResponse,
    chat.sendChatMessage, chat.sendReaction,
    chat.registerOnChatMessage, chat.registerOnReaction,
    registerOnMoveReceived, registerOnGameStart,
    registerOnStateRequested, registerOnSyncStateReceived,
    registerOnTakebackRequested, registerOnTakebackResponded,
    registerOnDrawOffered, registerOnDrawResponded,
  ]);
}
