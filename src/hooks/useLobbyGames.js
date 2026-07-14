import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useLobbyGames() {
  const [activeGames, setActiveGames] = useState([]);

  useEffect(() => {
    if (!supabase) return;

    // We use a global channel to track active games
    const lobbyChannel = supabase.channel('lobby:games');

    lobbyChannel.on('presence', { event: 'sync' }, () => {
      const state = lobbyChannel.presenceState();
      
      const gamesMap = new Map();
      
      // Parse the presence state
      Object.values(state).forEach(presences => {
        presences.forEach(presence => {
          // Only track presences that have game information
          if (presence.isHost && presence.gameCode) {
            gamesMap.set(presence.gameCode, {
              code: presence.gameCode,
              status: presence.status || 'waiting',
              players: presence.players || 1,
              createdAt: presence.joined_at,
            });
          }
        });
      });

      // Convert map to array and sort by newest first
      const gamesArray = Array.from(gamesMap.values()).sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      setActiveGames(gamesArray);
    });

    lobbyChannel.subscribe();

    return () => {
      supabase.removeChannel(lobbyChannel);
    };
  }, []);

  return activeGames;
}
