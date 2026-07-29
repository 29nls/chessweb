import { useRef, useCallback } from 'react';
import { sanitizeChatText, sanitizeReaction } from '../lib/validation';

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
    const sanitized = sanitizeChatText(text);
    if (!sanitized) return;
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: { playerId: playerIdRef.current, text: sanitized, color: playerColor },
      });
    }
  }, [channelRef, playerIdRef, playerColor]);

  const sendReaction = useCallback((emoji) => {
    const sanitized = sanitizeReaction(emoji);
    if (!sanitized) return;
    if (channelRef.current && playerColor !== 'spectator') {
      channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { playerId: playerIdRef.current, emoji: sanitized, color: playerColor },
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
