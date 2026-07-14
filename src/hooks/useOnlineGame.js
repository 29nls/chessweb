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

/**
 * Custom hook for 1v1 online chess via Supabase Realtime.
 *
 * @returns {object} Online game state and actions
 */
export function useOnlineGame() {
  // 'idle' | 'waiting' | 'playing' | 'finished'
  const [gameStatus, setGameStatus] = useState('idle');
  const [gameCode, setGameCode] = useState('');
  const [playerColor, setPlayerColor] = useState(null); // 'white' | 'black'
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [gameResult, setGameResult] = useState(null); // { winner, reason }
  const [error, setError] = useState(null);

  const channelRef = useRef(null);
  const playerIdRef = useRef(getPlayerId());
  const onMoveReceivedRef = useRef(null);
  const onGameStartRef = useRef(null);

  // Cleanup channel subscription
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // Subscribe to a game channel
  const subscribeToChannel = useCallback((code, color) => {
    if (!supabase) {
      setError('Supabase not configured. Check your .env file.');
      return;
    }

    cleanup();

    const channel = supabase.channel(`game:${code}`, {
      config: {
        broadcast: { self: false }, // Don't receive own broadcasts
        presence: { key: playerIdRef.current },
      },
    });

    // Listen for moves from opponent
    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current && onMoveReceivedRef.current) {
        onMoveReceivedRef.current(payload);
      }
    });

    // Listen for game events (resign, draw, etc.)
    channel.on('broadcast', { event: 'resign' }, ({ payload }) => {
      if (payload.playerId !== playerIdRef.current) {
        const winnerColor = color; // If opponent resigns, I win
        setGameResult({ winner: winnerColor, reason: 'Opponent resigned' });
        setGameStatus('finished');
      }
    });

    channel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
      setGameResult({ winner: payload.winner, reason: payload.reason });
      setGameStatus('finished');
    });

    // Track presence
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const players = Object.keys(state);
      const otherPlayers = players.filter(id => id !== playerIdRef.current);
      const isOpponentHere = otherPlayers.length > 0;
      setOpponentConnected(isOpponentHere);

      // If both players are present and we're waiting, start the game
      if (isOpponentHere && players.length >= 2) {
        setGameStatus(prev => {
          if (prev === 'waiting') {
            if (onGameStartRef.current) onGameStartRef.current();
            return 'playing';
          }
          return prev;
        });
      }
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      // Check if opponent left
      const opponentLeft = leftPresences.some(p => p.player_id !== playerIdRef.current);
      if (opponentLeft) {
        setOpponentConnected(false);
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          player_id: playerIdRef.current,
          color: color,
          joined_at: new Date().toISOString(),
        });
      }
    });

    channelRef.current = channel;
  }, [cleanup]);

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

  // Send a move to the opponent
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

  // Resign the game
  const resign = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'resign',
        payload: { playerId: playerIdRef.current },
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
    gameResult,
    error,

    // Actions
    createGame,
    joinGame,
    sendMove,
    resign,
    broadcastGameOver,
    leaveGame,

    // Callbacks
    onMoveReceived,
    onGameStart,
  };
}
