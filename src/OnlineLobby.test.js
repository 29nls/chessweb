import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OnlineStatusBar } from './OnlineLobby';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
  Element.prototype.scrollIntoView = jest.fn();
});

const renderStatusBar = (overrides = {}) => {
  const props = {
    playerColor: 'white',
    isMyTurn: true,
    opponentConnected: true,
    onResign: jest.fn(),
    onLeaveGame: jest.fn(),
    gameStatus: 'playing',
    ...overrides,
  };

  render(<OnlineStatusBar {...props} />);
  return props;
};

describe('OnlineStatusBar destructive actions', () => {
  test('requires confirmation before resigning', () => {
    const { onResign } = renderStatusBar();

    fireEvent.click(screen.getByRole('button', { name: /resign/i }));

    expect(onResign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirm resign/i }));
    expect(onResign).toHaveBeenCalledTimes(1);
  });

  test('requires confirmation before leaving a game', () => {
    const { onLeaveGame } = renderStatusBar();

    fireEvent.click(screen.getByRole('button', { name: /leave/i }));

    expect(onLeaveGame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirm leave/i }));
    expect(onLeaveGame).toHaveBeenCalledTimes(1);
  });
});
