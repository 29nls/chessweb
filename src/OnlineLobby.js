import React, { useState, useEffect, useRef } from 'react';
import { Wifi, Copy, Globe, Eye, Users } from 'react-feather';
import { useLobbyGames } from './hooks/useLobbyGames';
import './OnlineLobby.css';

/**
 * AccessibleDialog – A thin wrapper around native <dialog> that handles
 * showModal/close lifecycle and Escape-key support.
 */
const AccessibleDialog = ({ isOpen, onClose, labelledBy, children, className = '' }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e) => { e.preventDefault(); onClose(); };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className={`accessible-dialog ${className}`} aria-labelledby={labelledBy}>
      {children}
    </dialog>
  );
};

/**
 * OnlineLobby – Modal UI for creating/joining online games and spectating.
 */
const OnlineLobby = ({
  isOpen,
  initialTab,
  onClose,
  gameStatus,
  gameCode,
  playerColor,
  opponentConnected,
  gameResult,
  error,
  onCreateGame,
  onJoinGame,
  onJoinSpectator,
  onResign,
  onLeaveGame,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab || 'play');
  
  const activeGames = useLobbyGames();

  // Sync tab with props when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'play');
    }
  }, [isOpen, initialTab]);

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
    const isSpectator = playerColor === 'spectator';

    const resultTitle = isSpectator
      ? (isDraw ? 'Draw!' : `${gameResult.winner === 'white' ? 'White' : 'Black'} Wins!`)
      : (isDraw ? 'Draw!' : isWinner ? 'You Win!' : 'You Lose');

    return (
      <AccessibleDialog
        isOpen={true}
        onClose={onLeaveGame}
        labelledBy="game-result-title"
        className="game-result-dialog"
      >
        <div className="game-result-card">
          <div className="game-result-icon" aria-hidden="true">
            {isDraw ? '🤝' : (isWinner ? '🏆' : (isSpectator ? '🏁' : '😞'))}
          </div>
          <h2 id="game-result-title">{resultTitle}</h2>
          <p>{gameResult.reason}</p>
          <div className="game-result-actions">
            {!isSpectator && (
              <button className="game-result-btn-new" onClick={onLeaveGame}>
                New Game
              </button>
            )}
            <button className="game-result-btn-close" onClick={onLeaveGame}>
              Close
            </button>
          </div>
        </div>
      </AccessibleDialog>
    );
  }

  // ─── Lobby Modal (idle / waiting) ───
  if (gameStatus === 'idle' || gameStatus === 'waiting') {
    return (
      <AccessibleDialog
        isOpen={true}
        onClose={onClose}
        labelledBy="lobby-title"
        className="online-lobby-dialog"
      >
        <div className="online-lobby-card">
          <div className="lobby-header">
            <h2 id="lobby-title">
              <Globe size={24} aria-hidden="true" />
              Online Multiplayer
            </h2>
            <button className="lobby-close-btn" onClick={onClose} aria-label="Close lobby">
              &times;
            </button>
          </div>

          <div className="lobby-tabs">
            <button 
              className={`lobby-tab ${activeTab === 'play' ? 'active' : ''}`}
              onClick={() => setActiveTab('play')}
            >
              Play
            </button>
            <button 
              className={`lobby-tab ${activeTab === 'spectate' ? 'active' : ''}`}
              onClick={() => setActiveTab('spectate')}
            >
              Spectate
            </button>
          </div>

          {error && <div className="lobby-error">{error}</div>}

          {activeTab === 'play' && (
            gameStatus === 'idle' ? (
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
            )
          )}

          {activeTab === 'spectate' && (
            <div className="spectate-list-container">
              <p className="spectate-subtitle">Live Games</p>
              {activeGames.length === 0 ? (
                <div className="spectate-empty">
                  <Eye size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
                  <p>No active games right now.</p>
                </div>
              ) : (
                <ul className="spectate-list">
                  {activeGames.map(game => (
                    <li key={game.code} className="spectate-item" onClick={() => onJoinSpectator(game.code)}>
                      <div className="spectate-info">
                        <span className="spectate-code">#{game.code}</span>
                        <span className={`spectate-status ${game.status}`}>
                          {game.status === 'playing' ? 'In Progress' : 'Waiting...'}
                        </span>
                      </div>
                      <div className="spectate-players">
                        <Users size={14} style={{ marginRight: 4 }} />
                        {game.players} / 2
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

        </div>
      </AccessibleDialog>
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

  const isSpectator = playerColor === 'spectator';

  return (
    <div className="online-status-bar">
      {isSpectator ? (
        <div className="online-status-info">
          <span className="online-status-dot connected" />
          <span>👁️ Spectating</span>
        </div>
      ) : (
        <div className="online-status-info">
          <span className={`online-status-dot ${isMyTurn ? 'your-turn' : 'connected'}`} aria-hidden="true" />
          <span aria-live="polite" aria-atomic="true">
            {isMyTurn ? '⚡ Your turn' : '⏳ Opponent\'s turn'}
          </span>
          <span style={{ margin: '0 4px', color: 'var(--border-color)' }} aria-hidden="true">|</span>
          <span className={`online-status-dot ${opponentConnected ? 'connected' : 'disconnected'}`} aria-hidden="true" />
          <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>
            {opponentConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      )}

      <div className="online-status-actions">
        {!isSpectator && (
          <button className="online-btn-resign" onClick={onResign}>
            Resign
          </button>
        )}
        <button className="online-btn-leave" onClick={onLeaveGame}>
          Leave
        </button>
      </div>
    </div>
  );
};

export default OnlineLobby;
