import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';

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
  let id = localStorage.getItem('chessweb_player_id');
  if (!id) {
    id = 'player_' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('chessweb_player_id', id);
  }
  return id;
}

export function useOnlineGame() {
  // 'idle' | 'waiting' | 'playing' | 'finished'
  const [gameStatus, setGameStatus] = useState('idle');
  const [gameCode, setGameCode] = useState('');
  const [playerColor, setPlayerColor] = useState(null); // 'white' | 'black' | 'spectator'
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [gameResult, setGameResult] = useState(null); // { winner, reason }
  const [error, setError] = useState(null);
  const [spectatorCount, setSpectatorCount] = useState(0);

  const channelRef = useRef(null);
  const lobbyChannelRef = useRef(null);
  const playerIdRef = useRef(getPlayerId());
  const onMoveReceivedRef = useRef(null);
  const onGameStartRef = useRef(null);
  const onStateRequestedRef = useRef(null);
  const onSyncStateReceivedRef = useRef(null);

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

      // If both players are present and we're waiting, start the game
      if (isOpponentHere && pCount >= 2) {
        setGameStatus(prev => {
          if (prev === 'waiting') {
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

  // Create a new game (I am white)
  const createGame = useCallback(() => {
    const code = generateCode();
    setGameCode(code);
    setPlayerColor('white');
    setGameStatus('waiting');
    setGameResult(null);
    setError(null);
    subscribeToChannel(code, 'white');
    return code;
  }, [subscribeToChannel]);

  // Join an existing game (I am black)
  const joinGame = useCallback((code) => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError('Code must be 6 characters');
      return false;
    }
    setGameCode(normalized);
    setPlayerColor('black');
    setGameStatus('waiting'); // Will transition to 'playing' via presence sync
    setGameResult(null);
    setError(null);
    subscribeToChannel(normalized, 'black');
    return true;
  }, [subscribeToChannel]);

  // Join as a Spectator
  const joinAsSpectator = useCallback((code) => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== 6) {
      setError('Invalid Game Code');
      return false;
    }
    setGameCode(normalized);
    setPlayerColor('spectator');
    setGameStatus('playing'); // We assume it's playing if we spectate it
    setGameResult(null);
    setError(null);
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
    }
  }, [playerColor]);

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
  }, []);

  // Leave the game and return to idle
  const leaveGame = useCallback(() => {
    cleanup();
    setGameStatus('idle');
    setGameCode('');
    setPlayerColor(null);
    setOpponentConnected(false);
    setSpectatorCount(0);
    setGameResult(null);
    setError(null);
  }, [cleanup]);

  // Register callbacks
  const onMoveReceived = useCallback((callback) => {
    onMoveReceivedRef.current = callback;
  }, []);

  const onGameStart = useCallback((callback) => {
    onGameStartRef.current = callback;
  }, []);

  const onStateRequested = useCallback((callback) => {
    onStateRequestedRef.current = callback;
  }, []);

  const onSyncStateReceived = useCallback((callback) => {
    onSyncStateReceivedRef.current = callback;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    // State
    gameStatus,
    gameCode,
    playerColor,
    opponentConnected,
    spectatorCount,
    gameResult,
    error,

    // Actions
    createGame,
    joinGame,
    joinAsSpectator,
    sendMove,
    sendSyncState,
    resign,
    broadcastGameOver,
    leaveGame,

    // Callbacks
    onMoveReceived,
    onGameStart,
    onStateRequested,
    onSyncStateReceived,
  };
}
