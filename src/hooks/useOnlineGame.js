import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { parseSupabaseError, logSupabaseError } from '../lib/supabaseErrors';

// Generate a random 6-character alphanumeric code (uppercase)
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a random player ID persisted in localStorage
function getPlayerId() {
  try {
    let id = localStorage.getItem('chessweb_player_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('chessweb_player_id', id);
    }
    return id;
  } catch (err) {
    console.warn('useOnlineGame: localStorage unavailable for player ID:', err);
    return 'player_' + Math.random().toString(36).substring(2, 10);
  }
}

// Simpan state game untuk reconnect setelah refresh
function saveGameState(code, color, status) {
  try {
    localStorage.setItem('chessweb_active_game', JSON.stringify({ code, color, status, timestamp: Date.now() }));
  } catch (err) {
    console.warn('useOnlineGame: Failed to save game state:', err);
  }
}

function clearGameState() {
  try {
    localStorage.removeItem('chessweb_active_game');
  } catch (err) {
    console.warn('useOnlineGame: Failed to clear game state:', err);
  }
}

function getSavedGameState() {
  try {
    const raw = localStorage.getItem('chessweb_active_game');
    if (!raw) return null;
    const state = JSON.parse(raw);
    // Expire after 30 minutes
    if (Date.now() - state.timestamp > 30 * 60 * 1000) {
      clearGameState();
      return null;
    }
    return state;
  } catch (err) {
    console.warn('useOnlineGame: Failed to read saved game state:', err);
    return null;
  }
}

// Time control presets for the lobby
export const TIME_CONTROL_PRESETS = [
  { label: '1 min', initialMs: 1 * 60 * 1000 },
  { label: '3 min', initialMs: 3 * 60 * 1000 },
  { label: '5 min', initialMs: 5 * 60 * 1000 },
  { label: '10 min', initialMs: 10 * 60 * 1000 },
  { label: '30 min', initialMs: 30 * 60 * 1000 },
  { label: 'Untimed', initialMs: 0 },
];

export function useOnlineGame() {
  // 'idle' | 'waiting' | 'playing' | 'finished'
  const [gameStatus, setGameStatus] = useState('idle');
  const [gameCode, setGameCode] = useState('');
  const [playerColor, setPlayerColor] = useState(null); // 'white' | 'black' | 'spectator'
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [gameResult, setGameResult] = useState(null); // { winner, reason }
  const [error, setError] = useState(null);
  const [spectatorCount, setSpectatorCount] = useState(0);

  // ─── Clock State ───
  const [timeControlMs, setTimeControlMs] = useState(0);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  // Refs for interval to avoid stale closures
  const whiteTimeRef = useRef(0);
  const blackTimeRef = useRef(0);
  const activeClockColorRef = useRef(null); // 'white' | 'black' | null
  const clockIntervalRef = useRef(null);
  const clockGameCodeRef = useRef('');
  const isClockRunningRef = useRef(false);
  const timeControlMsRef = useRef(0);

  const channelRef = useRef(null);
  const lobbyChannelRef = useRef(null);
  const playerIdRef = useRef(getPlayerId());
  const onMoveReceivedRef = useRef(null);
  const onGameStartRef = useRef(null);
  const onStateRequestedRef = useRef(null);
  const onSyncStateReceivedRef = useRef(null);

  // Takeback & Draw callback refs
  const onTakebackRequestedRef = useRef(null);
  const onTakebackRespondedRef = useRef(null);
  const onDrawOfferedRef = useRef(null);
  const onDrawRespondedRef = useRef(null);

  // Chat & Reaction callback refs
  const onChatMessageRef = useRef(null);
  const onReactionRef = useRef(null);

  // Clock sync callback ref
  const onClockSyncRef = useRef(null);

  // Cleanup channel subscription & callback refs
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (lobbyChannelRef.current) {
      supabase.removeChannel(lobbyChannelRef.current);
      lobbyChannelRef.current = null;
    }
    onMoveReceivedRef.current = null;
    onGameStartRef.current = null;
    onStateRequestedRef.current = null;
    onSyncStateReceivedRef.current = null;
    onTakebackRequestedRef.current = null;
    onTakebackRespondedRef.current = null;
    onDrawOfferedRef.current = null;
    onDrawRespondedRef.current = null;
    onChatMessageRef.current = null;
    onReactionRef.current = null;
    onClockSyncRef.current = null;
    if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }
    activeClockColorRef.current = null;
    isClockRunningRef.current = false;
  }, []);

  // Update presence in the global lobby (Host only)
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
      console.warn("Failed to update lobby presence:", err);
    }
  }, []);

  // Subscribe to a game channel
  const subscribeToChannel = useCallback((code, color) => {
    if (!supabase) {
      setError('Supabase not configured. Check your .env file.');
      return;
    }

    cleanup();

    // If host (white), join the global lobby channel to broadcast this game's existence
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

    // Listen for moves from opponent or players (if spectator)
    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onMoveReceivedRef.current) {
        onMoveReceivedRef.current(payload);
      }
    });

    // Listen for game events
    channel.on('broadcast', { event: 'resign' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current) {
        // If I am playing, I win. If I am spectator, just show who resigned.
        const winnerColor = payload.color === 'white' ? 'black' : 'white';
        setGameResult({ winner: winnerColor, reason: `${payload.color} resigned` });
        setGameStatus('finished');
      }
    });

    channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
      setGameResult({ winner: payload.winner, reason: payload.reason });
      setGameStatus('finished');
    });

    // ─── Chat & Reaction Events ───
    channel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onChatMessageRef.current) {
        onChatMessageRef.current(payload.text, payload.color, payload.playerId);
      }
    });

    channel.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onReactionRef.current) {
        onReactionRef.current(payload.emoji, payload.color, payload.playerId);
      }
    });

    // ─── Takeback Events ───
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

    // ─── Clock Sync Event ───
    channel.on('broadcast', { event: 'clock_sync' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onClockSyncRef.current) {
        onClockSyncRef.current(payload.whiteTime, payload.blackTime, payload.activeColor);
      }
    });

    // ─── Draw Events ───
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

    // P2P State Synchronization for Spectators
    channel.on('broadcast', { event: 'request_state' }, ({ payload }) => {
      // If I am a player (not a spectator) and I get a state request, I'll provide it.
      // Usually, White acts as the source of truth to avoid sending duplicate syncs.
      if (color === 'white' && onStateRequestedRef.current) {
        onStateRequestedRef.current(payload.spectatorId);
      } else if (color === 'black' && onStateRequestedRef.current) {
        // Fallback: If white is disconnected (rare), black could answer, but let's stick to white or whoever receives it if white isn't there
        onStateRequestedRef.current(payload.spectatorId);
      }
    });

    channel.on('broadcast', { event: 'sync_state' }, ({ payload }) => {
      // If I requested the state, I receive it here
      if (color === 'spectator' && payload.targetId === playerIdRef.current && onSyncStateReceivedRef.current) {
        onSyncStateReceivedRef.current(payload.fen, payload.moves, payload.history);
      }
    });

    // Track presence
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

      // If we are playing, the opponent is connected if pCount >= 2 (me and them)
      // If we are spectator, we don't care about opponentConnected as much, but let's say true if players are present.
      const isOpponentHere = pCount >= 2;
      setOpponentConnected(isOpponentHere);

      // Update global lobby if I am the host
      if (color === 'white') {
        updateLobbyPresence(code, pCount >= 2 ? 'playing' : 'waiting', pCount);
      }

      // Race condition detection: if two players claimed the same color, resolve it
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
        // Leave gracefully instead of corrupting the game
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
        return; // Stop further processing
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

      // If both players are present and we're waiting, start the game
      if (isOpponentHere && pCount >= 2) {
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

        // If I am a spectator, immediately request current state
        if (color === 'spectator') {
          channel.send({
            type: 'broadcast',
            event: 'request_state',
            payload: { spectatorId: playerIdRef.current }
          });
        }
      }
    });

    channelRef.current = channel;
  }, [cleanup, updateLobbyPresence]);

  // Coba restore state game yang tersimpan (reconnect setelah refresh)
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

  // Create a new game (I am white)
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
      setTimeControlMs(timeMs);
      timeControlMsRef.current = timeMs;
      if (timeMs > 0) {
        whiteTimeRef.current = timeMs;
        blackTimeRef.current = timeMs;
        setWhiteTime(timeMs);
        setBlackTime(timeMs);
      }
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

  // Cek apakah slot warna sudah terisi di channel tertentu
  const checkSlotAvailability = useCallback(async (code, desiredColor) => {
    if (!supabase) return true; // skip jika Supabase tidak terkonfigurasi
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
          
          if (desiredColor === 'black') {
            resolve(!blackTaken);
          } else {
            resolve(true);
          }
        });
        
        tempChannel.subscribe();
      });
    } catch (err) {
      console.warn('useOnlineGame: Failed to check slot availability:', err);
      return true;
    }
  }, []);

  // Join an existing game (I am black)
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
        timeControlMsRef.current = claim.time_control_ms || 0;
        setTimeControlMs(claim.time_control_ms || 0);
        setWhiteTime(claim.time_control_ms || 0);
        setBlackTime(claim.time_control_ms || 0);
      } catch (rawError) {
        const parsed = parseSupabaseError(rawError);
        logSupabaseError('joinGame.catch', rawError);
        setError(parsed.friendly);
        return false;
      }
    } else {
      // Local-only fallback where cross-device atomicity cannot be guaranteed.
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

  // Join as a Spectator
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


  // Send a move to the opponent/spectators
  const sendMove = useCallback((moveData) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'move',
        payload: {
          ...moveData,
          playerId: playerIdRef.current,
        },
      });
    }
  }, []);

  // Send clock sync to opponent — reads from refs for live values
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
  }, []);

  // ─── Clock management — uses refs to avoid stale closures ───

  const handleFlagFall = useCallback((loserColor) => {
    if (!clockIntervalRef.current) return; // Already handled
    clearInterval(clockIntervalRef.current);
    clockIntervalRef.current = null;
    activeClockColorRef.current = null;
    isClockRunningRef.current = false;
    const winner = loserColor === 'white' ? 'black' : 'white';
    setGameResult({ winner, reason: 'Time forfeit' });
    setGameStatus('finished');
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast', event: 'game_over',
        payload: { winner, reason: 'Time forfeit', playerId: playerIdRef.current },
      });
    }
    if (clockGameCodeRef.current) saveGameState(clockGameCodeRef.current, playerColorRef.current, 'finished');
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

    // Flag fall
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

  // Expose direct setters for clock sync drift correction
  const setClockTimesFromSync = useCallback((wt, bt) => {
    whiteTimeRef.current = wt;
    blackTimeRef.current = bt;
    setWhiteTime(wt);
    setBlackTime(bt);
  }, []);

  // Player color ref for use in clock callbacks
  const playerColorRef = useRef(playerColor);
  useEffect(() => { playerColorRef.current = playerColor; }, [playerColor]);
  useEffect(() => { clockGameCodeRef.current = gameCode; }, [gameCode]);
  // Keep timeControlMsRef in sync
  useEffect(() => { timeControlMsRef.current = timeControlMs; }, [timeControlMs]);

  // Send state sync to a spectator
  const sendSyncState = useCallback((targetId, fen, moves, history) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'sync_state',
        payload: { targetId, fen, moves, history }
      });
    }
  }, []);

  // Resign the game
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

  // Broadcast game over (checkmate, stalemate, etc.)
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
    // Bugfix: update localStorage agar tidak direstore oleh reconnect logic
    if (gameCode) saveGameState(gameCode, playerColor, 'finished');
  }, [gameCode, playerColor]);

  // ─── Takeback Actions ───
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
      // Bugfix: jika accepted, update lokal state agar tidak desync
      // onTakebackResponded tidak akan dipanggil untuk diri sendiri (broadcast: {self: false})
      if (accepted && onTakebackRespondedRef.current) {
        // Panggil langsung callback untuk update papan lokal
        onTakebackRespondedRef.current(true, playerIdRef.current);
      }
    }
  }, [playerColor]);

  // ─── Draw Actions ───
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
        // Broadcast game_over so spectators see the result too
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

  // Leave the game and return to idle
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

  // Register callbacks
  const onMoveReceived = useCallback((callback) => {
    onMoveReceivedRef.current = callback;
  }, []);

  const onGameStart = useCallback((callback) => {
    onGameStartRef.current = callback;
  }, []);

  const onClockSync = useCallback((callback) => {
    onClockSyncRef.current = callback;
  }, []);

  const onStateRequested = useCallback((callback) => {
    onStateRequestedRef.current = callback;
  }, []);

  const onSyncStateReceived = useCallback((callback) => {
    onSyncStateReceivedRef.current = callback;
  }, []);

  // ─── Chat & Reaction Actions ───
  const sendChatMessage = useCallback((text) => {
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: { playerId: playerIdRef.current, text, color: playerColor },
      });
    }
  }, [playerColor]);

  const sendReaction = useCallback((emoji) => {
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { playerId: playerIdRef.current, emoji, color: playerColor },
      });
    }
  }, [playerColor]);

  // Register takeback & draw callbacks
  const onTakebackRequested = useCallback((callback) => {
    onTakebackRequestedRef.current = callback;
  }, []);

  const onTakebackResponded = useCallback((callback) => {
    onTakebackRespondedRef.current = callback;
  }, []);

  const onDrawOffered = useCallback((callback) => {
    onDrawOfferedRef.current = callback;
  }, []);

  const onDrawResponded = useCallback((callback) => {
    onDrawRespondedRef.current = callback;
  }, []);

  // Register chat & reaction callbacks
  const onChatMessage = useCallback((callback) => {
    onChatMessageRef.current = callback;
  }, []);

  const onReaction = useCallback((callback) => {
    onReactionRef.current = callback;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Bugfix #2: memoize return object to prevent cascading re-renders in OnlinePage.
  // All callbacks are stable (wrapped in useCallback), so the object reference only
  // changes when state values actually change.
  return useMemo(() => ({
    // State
    gameStatus,
    gameCode,
    playerColor,
    opponentConnected,
    spectatorCount,
    gameResult,
    error,

    // Clock state
    timeControlMs,
    whiteTime,
    blackTime,

    // Clock actions
    startClock,
    stopClock,
    sendClockSync,
    setTimeControl,
    setClockTimesFromSync,

    // Actions
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
    sendChatMessage,
    sendReaction,

    // Callbacks
    onMoveReceived,
    onGameStart,
    onClockSync,
    onStateRequested,
    onSyncStateReceived,
    onTakebackRequested,
    onTakebackResponded,
    onDrawOffered,
    onDrawResponded,
    onChatMessage,
    onReaction,
  }), [
    gameStatus,
    gameCode,
    playerColor,
    opponentConnected,
    spectatorCount,
    gameResult,
    error,
    timeControlMs,
    whiteTime,
    blackTime,
    startClock,
    stopClock,
    sendClockSync,
    setTimeControl,
    setClockTimesFromSync,
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
    sendChatMessage,
    sendReaction,
    onMoveReceived,
    onGameStart,
    onClockSync,
    onStateRequested,
    onSyncStateReceived,
    onTakebackRequested,
    onTakebackResponded,
    onDrawOffered,
    onDrawResponded,
    onChatMessage,
    onReaction,
  ]);
}
