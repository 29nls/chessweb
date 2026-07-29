import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useChat } from './useChat';

/**
 * Creates mock refs for channel and playerId as passed to useChat.
 * Returns a jest.fn() as the channel's `send` so we can verify calls.
 */
function createMocks({ channelPresent = true, playerColor = 'white', playerId = 'p1' } = {}) {
  const send = jest.fn();
  const channelRef = { current: channelPresent ? { send } : null };
  const playerIdRef = { current: playerId };
  return { channelRef, playerIdRef, send, playerColor, playerId };
}

// ── useChat tests ───────────────────────────────────────

describe('useChat', () => {
  describe('sendChatMessage', () => {
    test('sends chat_message broadcast via channel', () => {
      const { channelRef, playerIdRef, send, playerColor } = createMocks();
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor }));

      act(() => { result.current.sendChatMessage('Hello!'); });

      expect(send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'chat_message',
        payload: { playerId: 'p1', text: 'Hello!', color: 'white' },
      });
    });

    test('does NOT send when player is a spectator', () => {
      const { channelRef, playerIdRef, send } = createMocks({ playerColor: 'spectator' });
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'spectator' }));

      act(() => { result.current.sendChatMessage('Hi!'); });

      expect(send).not.toHaveBeenCalled();
    });

    test('does NOT send when channel is null', () => {
      const { channelRef, playerIdRef, send } = createMocks({ channelPresent: false });
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'white' }));

      act(() => { result.current.sendChatMessage('Hi!'); });

      expect(send).not.toHaveBeenCalled();
    });

    test('includes correct playerColor in payload when black', () => {
      const { channelRef, playerIdRef, send } = createMocks({ playerColor: 'black' });
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'black' }));

      act(() => { result.current.sendChatMessage('gg'); });

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ color: 'black', text: 'gg' }),
        })
      );
    });
  });

  describe('sendReaction', () => {
    test('sends reaction broadcast via channel', () => {
      const { channelRef, playerIdRef, send, playerColor } = createMocks();
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor }));

      act(() => { result.current.sendReaction('👍'); });

      expect(send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'reaction',
        payload: { playerId: 'p1', emoji: '👍', color: 'white' },
      });
    });

    test('does NOT send reaction when spectator', () => {
      const { channelRef, playerIdRef, send } = createMocks({ playerColor: 'spectator' });
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'spectator' }));

      act(() => { result.current.sendReaction('🔥'); });

      expect(send).not.toHaveBeenCalled();
    });

    test('does NOT send reaction when channel is null', () => {
      const { channelRef, playerIdRef, send } = createMocks({ channelPresent: false });
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'white' }));

      act(() => { result.current.sendReaction('🔥'); });

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('registerOnChatMessage / registerOnReaction', () => {
    test('registers and invokes onChatMessage callback', () => {
      const { channelRef, playerIdRef } = createMocks();
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'white' }));

      const cb = jest.fn();
      act(() => { result.current.registerOnChatMessage(cb); });

      // Simulate channel event — the parent calls the ref directly
      act(() => { result.current.onChatMessageRef.current('hello', 'black', 'p2'); });

      expect(cb).toHaveBeenCalledWith('hello', 'black', 'p2');
    });

    test('registers and invokes onReaction callback', () => {
      const { channelRef, playerIdRef } = createMocks();
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'white' }));

      const cb = jest.fn();
      act(() => { result.current.registerOnReaction(cb); });

      act(() => { result.current.onReactionRef.current('😂', 'black', 'p2'); });

      expect(cb).toHaveBeenCalledWith('😂', 'black', 'p2');
    });

    test('onChatMessageRef is null when no callback registered', () => {
      const { channelRef, playerIdRef } = createMocks();
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'white' }));

      expect(result.current.onChatMessageRef.current).toBeNull();
    });

    test('onReactionRef is null when no callback registered', () => {
      const { channelRef, playerIdRef } = createMocks();
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'white' }));

      expect(result.current.onReactionRef.current).toBeNull();
    });
  });

  describe('clearChatRefs', () => {
    test('nullifies both onChatMessageRef and onReactionRef', () => {
      const { channelRef, playerIdRef } = createMocks();
      const { result } = renderHook(() => useChat({ channelRef, playerIdRef, playerColor: 'white' }));

      act(() => { result.current.registerOnChatMessage(jest.fn()); });
      act(() => { result.current.registerOnReaction(jest.fn()); });

      expect(result.current.onChatMessageRef.current).not.toBeNull();
      expect(result.current.onReactionRef.current).not.toBeNull();

      act(() => { result.current.clearChatRefs(); });

      expect(result.current.onChatMessageRef.current).toBeNull();
      expect(result.current.onReactionRef.current).toBeNull();
    });
  });
});
