import { useRef, useCallback } from 'react';

/**
 * useChat — Encapsulates chat message and emoji reaction sending/receiving
 * over the Supabase Realtime channel. Extracted from useOnlineGame.
 *
 * @param {Object} params
 * @param {React.MutableRefObject} params.channelRef - Supabase Realtime channel ref
 * @param {React.MutableRefObject<string>} params.playerIdRef - Player ID ref
 * @param {string} params.playerColor - 'white' | 'black' | 'spectator'
 * @returns {Object} chat actions and callback registrations
 */
export function useChat({ channelRef, playerIdRef, playerColor }) {
  const onChatMessageRef = useRef(null);
  const onReactionRef = useRef(null);

  const sendChatMessage = useCallback((text) => {
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: { playerId: playerIdRef.current, text, color: playerColor },
      });
    }
  }, [channelRef, playerIdRef, playerColor]);

  const sendReaction = useCallback((emoji) => {
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { playerId: playerIdRef.current, emoji, color: playerColor },
      });
    }
  }, [channelRef, playerIdRef, playerColor]);

  const registerOnChatMessage = useCallback((callback) => {
    onChatMessageRef.current = callback;
  }, []);

  const registerOnReaction = useCallback((callback) => {
    onReactionRef.current = callback;
  }, []);

  // Clear refs (called during cleanup)
  const clearChatRefs = useCallback(() => {
    onChatMessageRef.current = null;
    onReactionRef.current = null;
  }, []);

  return {
    sendChatMessage,
    sendReaction,
    registerOnChatMessage,
    registerOnReaction,
    onChatMessageRef,
    onReactionRef,
    clearChatRefs,
  };
}
