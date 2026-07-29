import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { Wifi, Copy, Globe, Eye, Users } from 'react-feather';
import { useLobbyGames } from './hooks/useLobbyGames';
import { TIME_CONTROL_PRESETS } from './lib/onlineGameUtils';
import { sanitizeChatText } from './lib/validation';
import AccessibleDialog from './AccessibleDialog';
import './OnlineLobby.css';

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
  onShareReplay,
}) => {
  const [selectedTimeMs, setSelectedTimeMs] = useState(5 * 60 * 1000); // Default: 5 min
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
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toast.warning('Please enter a game code first.');
      return;
    }
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      toast.warning('Game code must be 6 letters or numbers.');
      return;
    }
    onJoinGame(code);
  };

  const handleCreateGame = async () => {
    const created = await onCreateGame(selectedTimeMs);
    if (created) return;
    // Error sudah di-set oleh useOnlineGame dan ditampilkan di lobby-error
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleJoin();
  };



  const handleCopyCode = () => {
    navigator.clipboard.writeText(gameCode).then(() => {
      toast.success('Game code copied!');
    }).catch(() => {
      toast.error('Failed to copy code. Please copy manually: ' + gameCode);
    });
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
            {onShareReplay && (
              <button
                className="game-result-btn-share"
                onClick={onShareReplay}
              >
                Share Replay
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

          <div className="lobby-tabs" role="tablist" aria-label="Lobby tabs">
            <button
              role="tab"
              id="lobby-tab-play"
              aria-selected={activeTab === 'play'}
              aria-controls="lobby-panel-play"
              className={`lobby-tab ${activeTab === 'play' ? 'active' : ''}`}
              onClick={() => setActiveTab('play')}
            >
              Play
            </button>
            <button
              role="tab"
              id="lobby-tab-spectate"
              aria-selected={activeTab === 'spectate'}
              aria-controls="lobby-panel-spectate"
              className={`lobby-tab ${activeTab === 'spectate' ? 'active' : ''}`}
              onClick={() => setActiveTab('spectate')}
            >
              Spectate
            </button>
          </div>

          {activeTab === 'play' && (
            <div role="tabpanel" id="lobby-panel-play" aria-labelledby="lobby-tab-play">
            {gameStatus === 'idle' ? (
              <div className="lobby-actions">
                <div className="lobby-time-control">
                  <label className="lobby-time-label">Time Control</label>
                  <div className="lobby-time-options">
                    {TIME_CONTROL_PRESETS.map(opt => (
                      <button
                        key={opt.label}
                        className={`lobby-time-btn ${selectedTimeMs === opt.initialMs ? 'active' : ''}`}
                        onClick={() => setSelectedTimeMs(opt.initialMs)}
                        aria-pressed={selectedTimeMs === opt.initialMs}
                        aria-label={`${opt.label} time control`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Create error inline */}
                {error && gameStatus === 'idle' && (
                  <div className="lobby-error" role="alert" aria-live="assertive">
                    {error}
                  </div>
                )}

                <button className="lobby-btn-create" onClick={handleCreateGame}>
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
                  <span className="lobby-waiting-text">Waiting for opponent...</span>
                </div>

                <div className="lobby-player-color">
                  You play as{' '}
                  <strong className={`lobby-color-badge ${playerColor === 'white' ? 'color-white' : 'color-black'}`}>
                    {playerColor}
                  </strong>
                </div>

                <button className="lobby-btn-cancel" onClick={onLeaveGame}>
                  Cancel
                </button>
              </div>
            )}
            </div>
          )}

          {activeTab === 'spectate' && (
            <div role="tabpanel" id="lobby-panel-spectate" aria-labelledby="lobby-tab-spectate">
            {/* Spectate error inline */}
            {error && (
              <div className="lobby-error lobby-error-spectate" role="alert" aria-live="assertive">
                {error}
              </div>
            )}
            <div className="spectate-list-container">
              <p className="spectate-subtitle">Live Games</p>
              {activeGames.length === 0 ? (
                <div className="spectate-empty">
                  <div className="spectate-empty-icon" aria-hidden="true">
                    <Eye size={40} />
                  </div>
                  <p>No active games right now.</p>
                </div>
              ) : (
                <div className="spectate-list" role="group" aria-label="Active games">
                  {activeGames.map(game => (
                    <div
                      key={game.code}
                      className="spectate-item"
                      onClick={() => onJoinSpectator(game.code)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJoinSpectator(game.code); } }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Spectate game ${game.code}, ${game.status === 'playing' ? 'in progress' : 'waiting'}, ${game.players} of 2 players`}
                    >
                      <div className="spectate-info">
                        <span className="spectate-code">#{game.code}</span>
                        <span className={`spectate-status ${game.status}`}>
                          {game.status === 'playing' ? 'In Progress' : 'Waiting...'}
                        </span>
                      </div>
                      <div className="spectate-players">
                        <Users size={14} className="spectate-players-icon" aria-hidden="true" />
                        {game.players} / 2
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
const QUICK_REACTIONS = ['👍', '👏', '😂', '🎉', '🤔', '😢', '🔥', '💪'];

/**
 * ChatPanel – Chat and quick-reactions UI shown during an online match.
 */
const ChatPanel = ({
  messages,
  onSendMessage,
  onSendReaction,
  playerColor,
  isSpectator,
}) => {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Format timestamp for messages
  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Auto-scroll to newest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = sanitizeChatText(inputText);
    if (!text) return;
    onSendMessage(text);
    setInputText('');
    inputRef.current?.focus();
  };

  // Emoji whitelist is enforced by the sender (useChat), but also guard here
  // so the UI never dispatches unexpected reactions.

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet. Send a reaction or chat!</div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-msg ${msg.isOwn ? 'chat-msg-own' : ''} ${msg.type === 'reaction' ? 'chat-reaction' : ''}`}
          >
            {msg.type === 'reaction' ? (
              <span className="chat-reaction-emoji" title={msg.sender}>
                {msg.text}
              </span>
            ) : (
              <>
                <span className={`chat-msg-sender ${msg.senderColor === 'white' ? 'sender-white' : 'sender-black'}`}>
                  {msg.sender}
                </span>
                <span className="chat-msg-text">
                  {msg.text}
                  <span className="chat-msg-time">{formatTime()}</span>
                </span>
              </>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Reactions */}
      {!isSpectator && (
        <div className="chat-reactions">
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              className="reaction-btn"
              onClick={() => onSendReaction(emoji)}
              title={`Send ${emoji}`}
              aria-label={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Chat Input */}
      {!isSpectator && (
        <div className="chat-input-row">
          <input
            ref={inputRef}
            className="chat-input"
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={200}
            aria-label="Chat message"
          />
          <button className="chat-send-btn" onClick={handleSend} disabled={!inputText.trim()} aria-label="Send">
            Send
          </button>
        </div>
      )}
    </div>
  );
};

/** Format milliseconds to MM:SS */
function formatClock(ms) {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export const OnlineStatusBar = ({
  playerColor,
  isMyTurn,
  opponentConnected,
  onResign,
  onLeaveGame,
  gameStatus,
  movesCount = 0,
  spectatorCount = 0,
  connectionQuality = 'connected',
  // Takeback props
  onRequestTakeback,
  pendingTakeback,
  takebackRequestState,
  onAcceptTakeback,
  onDeclineTakeback,
  // Draw props
  onOfferDraw,
  pendingDraw,
  drawRequestState,
  onAcceptDraw,
  onDeclineDraw,
  // Chat props
  messages = [],
  onSendMessage,
  onSendReaction,
  // Clock props
  whiteTime = 0,
  blackTime = 0,
  timeControlMs = 0,
}) => {
  const [pendingAction, setPendingAction] = useState(null);
  if (gameStatus !== 'playing') return null;

  const isSpectator = playerColor === 'spectator';
  const isWhiteActive = (isMyTurn && playerColor === 'white') || (!isMyTurn && playerColor === 'black');

  const whiteClockClass = [
    'clock-display',
    'clock-white',
    isWhiteActive && whiteTime > 0 ? 'clock-active' : '',
    whiteTime <= 0 && timeControlMs > 0 ? 'clock-expired' : '',
  ].filter(Boolean).join(' ');

  const blackClockClass = [
    'clock-display',
    'clock-black',
    !isWhiteActive && blackTime > 0 ? 'clock-active' : '',
    blackTime <= 0 && timeControlMs > 0 ? 'clock-expired' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className="online-status-bar">
        {/* ⏱ Clock Display */}
        {timeControlMs > 0 && (
          <div className="clock-container" role="timer" aria-label={`White: ${formatClock(whiteTime)}, Black: ${formatClock(blackTime)}`}>
            <div className={whiteClockClass}>
              <span className="clock-label">White</span>
              <span className="clock-time" aria-live="polite" aria-atomic="true">{formatClock(whiteTime)}</span>
            </div>
            <div className={blackClockClass}>
              <span className="clock-label">Black</span>
              <span className="clock-time" aria-live="polite" aria-atomic="true">{formatClock(blackTime)}</span>
            </div>
          </div>
        )}

        {isSpectator ? (
          <div className="online-status-info">
              <span className="online-status-dot connected" aria-hidden="true" />
            <span>👁️ Spectating</span>
          </div>
        ) : (
          <div className="online-status-info">
            <span className={`online-status-dot ${isMyTurn ? 'your-turn' : 'connected'}`} aria-hidden="true" />
            <span aria-live="polite" aria-atomic="true">
              {isMyTurn ? '⚡ Your turn' : "⏳ Opponent's turn"}
            </span>
            <span className="status-separator" aria-hidden="true">|</span>
            <span className={`online-status-dot ${connectionQuality === 'connected' ? 'connected' : 'reconnecting'}`} aria-hidden="true" />
            <span className="connection-text">
              {connectionQuality === 'connected' ? 'Connected' : '● Disconnected'}
            </span>
            {spectatorCount > 0 && (
              <>
                <span className="status-separator" aria-hidden="true">|</span>
                <span className="spectator-count-text">
                  👁️ {spectatorCount} {spectatorCount === 1 ? 'spectator' : 'spectators'}
                </span>
              </>
            )}
          </div>
        )}

        <div className="online-status-actions">
          {!isSpectator && takebackRequestState !== 'sent' && (
            <button
              className="online-action-btn online-btn-takeback"
              onClick={onRequestTakeback}
              disabled={movesCount === 0}
              title={movesCount === 0 ? 'No moves to take back' : 'Request takeback'}
            >
              ↩ Takeback
            </button>
          )}
          {!isSpectator && drawRequestState !== 'sent' && (
            <button
              className="online-action-btn online-btn-draw"
              onClick={onOfferDraw}
              title="Offer draw"
            >
              🤝 Draw
            </button>
          )}
          {!isSpectator && (
            <button className="online-action-btn online-btn-resign" onClick={() => setPendingAction('resign')}>
              Resign
            </button>
          )}
          <button className="online-action-btn online-btn-leave" onClick={() => setPendingAction('leave')}>
            Leave
          </button>
        </div>
      </div>

      <AccessibleDialog
        isOpen={pendingAction !== null}
        onClose={() => setPendingAction(null)}
        labelledBy="confirm-game-action-title"
        describedBy="confirm-game-action-description"
        className="game-action-dialog"
      >
        <div className="game-action-card">
          <h2 id="confirm-game-action-title">{pendingAction === 'resign' ? 'Resign game?' : 'Leave game?'}</h2>
          <p id="confirm-game-action-description">
            {pendingAction === 'resign'
              ? 'This immediately awards the game to your opponent.'
              : 'Leaving disconnects you from this game.'}
          </p>
          <div className="game-action-buttons">
            <button className="game-action-btn decline" onClick={() => setPendingAction(null)}>Cancel</button>
            <button
              className="game-action-btn accept"
              aria-label={pendingAction === 'resign' ? 'Confirm resign' : 'Confirm leave'}
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                if (action === 'resign') onResign(); else onLeaveGame();
              }}
            >
              {pendingAction === 'resign' ? 'Resign' : 'Leave'}
            </button>
          </div>
        </div>
      </AccessibleDialog>

      {/* Chat Panel */}
      {messages !== undefined && (
        <ChatPanel
          messages={messages}
          onSendMessage={onSendMessage || (() => {})}
          onSendReaction={onSendReaction || (() => {})}
          playerColor={playerColor}
          isSpectator={isSpectator}
        />
      )}

      {/* Takeback Request Modal (received) */}
      {pendingTakeback && takebackRequestState === 'received' && (
        <AccessibleDialog isOpen={true} onClose={onDeclineTakeback} labelledBy="takeback-title" className="game-action-dialog">
          <div className="game-action-card">
            <div className="game-action-icon">↩️</div>
            <h2 id="takeback-title">Takeback Request</h2>
            <p>Your opponent wants to take back the last move. Accept?</p>
            <div className="game-result-actions">
              <button className="game-result-btn-new" onClick={onAcceptTakeback}>Accept</button>
              <button className="game-result-btn-close" onClick={onDeclineTakeback}>Decline</button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Draw Offer Modal (received) */}
      {pendingDraw && drawRequestState === 'received' && (
        <AccessibleDialog isOpen={true} onClose={onDeclineDraw} labelledBy="draw-title" className="game-action-dialog">
          <div className="game-action-card">
            <div className="game-action-icon">🤝</div>
            <h2 id="draw-title">Draw Offer</h2>
            <p>Your opponent offers a draw. Accept?</p>
            <div className="game-result-actions">
              <button className="game-result-btn-new" onClick={onAcceptDraw}>Accept</button>
              <button className="game-result-btn-close" onClick={onDeclineDraw}>Decline</button>
            </div>
          </div>
        </AccessibleDialog>
      )}
    </>
  );
};

export default OnlineLobby;
