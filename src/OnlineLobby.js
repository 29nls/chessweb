import React, { useState } from 'react';
import { Wifi, Copy, Globe } from 'react-feather';
import './OnlineLobby.css';

/**
 * OnlineLobby – Modal UI for creating/joining online games.
 */
const OnlineLobby = ({
  isOpen,
  onClose,
  gameStatus,
  gameCode,
  playerColor,
  opponentConnected,
  gameResult,
  error,
  onCreateGame,
  onJoinGame,
  onResign,
  onLeaveGame,
}) => {
  const [joinCode, setJoinCode] = useState('');

  if (!isOpen && gameStatus === 'idle') return null;

  const handleJoin = () => {
    if (joinCode.trim()) {
      onJoinGame(joinCode.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleJoin();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(gameCode);
  };

  // ─── Game Result Modal ───
  if (gameResult && gameStatus === 'finished') {
    const isWinner = gameResult.winner === playerColor;
    const isDraw = gameResult.winner === 'draw';
    return (
      <div className="game-result-overlay" onClick={onLeaveGame}>
        <div className="game-result-card" onClick={e => e.stopPropagation()}>
          <div className="game-result-icon">
            {isDraw ? '🤝' : isWinner ? '🏆' : '😞'}
          </div>
          <h2>
            {isDraw ? 'Draw!' : isWinner ? 'You Win!' : 'You Lose'}
          </h2>
          <p>{gameResult.reason}</p>
          <div className="game-result-actions">
            <button className="game-result-btn-new" onClick={() => { onLeaveGame(); }}>
              New Game
            </button>
            <button className="game-result-btn-close" onClick={onLeaveGame}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Lobby Modal (idle / waiting) ───
  if (gameStatus === 'idle' || gameStatus === 'waiting') {
    return (
      <div className="online-lobby-overlay" onClick={onClose}>
        <div className="online-lobby-card" onClick={e => e.stopPropagation()}>
          <div className="lobby-header">
            <h2>
              <Globe size={24} />
              Play Online
            </h2>
            <button className="lobby-close-btn" onClick={onClose}>
              &times;
            </button>
          </div>

          {error && <div className="lobby-error">{error}</div>}

          {gameStatus === 'idle' ? (
            <div className="lobby-actions">
              <button className="lobby-btn-create" onClick={onCreateGame}>
                <Wifi size={20} />
                Create Game
              </button>

              <div className="lobby-divider">
                <span>or join</span>
              </div>

              <div className="lobby-join-row">
                <input
                  className="lobby-code-input"
                  type="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter code"
                  autoFocus
                />
                <button className="lobby-btn-join" onClick={handleJoin}>
                  Join
                </button>
              </div>
            </div>
          ) : (
            /* Waiting for opponent */
            <div className="lobby-waiting">
              <div className="lobby-code-display">
                <label>Share this code with your opponent</label>
                <div className="lobby-code-value">
                  <span>{gameCode}</span>
                  <button className="lobby-code-copy-btn" onClick={handleCopyCode} title="Copy code">
                    <Copy size={18} />
                  </button>
                </div>
              </div>

              <div className="lobby-waiting-dots">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <span style={{ marginLeft: 6 }}>Waiting for opponent...</span>
              </div>

              <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                You play as <strong style={{ color: playerColor === 'white' ? '#f0f0f0' : '#333', background: playerColor === 'white' ? '#333' : '#f0f0f0', padding: '2px 8px', borderRadius: 4 }}>{playerColor}</strong>
              </div>

              <button className="lobby-btn-cancel" onClick={onLeaveGame}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

/**
 * OnlineStatusBar – In-game status bar shown during an online match.
 */
export const OnlineStatusBar = ({
  playerColor,
  isMyTurn,
  opponentConnected,
  onResign,
  onLeaveGame,
  gameStatus,
}) => {
  if (gameStatus !== 'playing') return null;

  return (
    <div className="online-status-bar">
      <div className="online-status-info">
        <span className={`online-status-dot ${isMyTurn ? 'your-turn' : 'connected'}`} />
        <span>
          {isMyTurn ? '⚡ Your turn' : '⏳ Opponent\'s turn'}
        </span>
        <span style={{ margin: '0 4px', color: 'var(--border-color)' }}>|</span>
        <span className={`online-status-dot ${opponentConnected ? 'connected' : 'disconnected'}`} />
        <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
          {opponentConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div className="online-status-actions">
        <button className="online-btn-resign" onClick={onResign}>
          Resign
        </button>
        <button className="online-btn-leave" onClick={onLeaveGame}>
          Leave
        </button>
      </div>
    </div>
  );
};

export default OnlineLobby;
