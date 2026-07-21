import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Clock, Cpu, Trash2, Play, ChevronRight } from 'react-feather';
import { getGames, deleteGame } from '../lib/gameHistory';
import './GameHistoryPanel.css';

/**
 * Format a date string for display.
 */
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format move count for display.
 */
function formatMoves(count) {
  if (!count) return '0 moves';
  const pairs = Math.ceil(count / 2);
  return `${pairs} move${pairs !== 1 ? 's' : ''}`;
}

/**
 * Get a friendly result label.
 */
function resultLabel(result) {
  if (!result) return '';
  if (result.winner === 'draw') return 'Draw';
  if (result.winner === 'white') return 'White won';
  if (result.winner === 'black') return 'Black won';
  return '';
}

/**
 * Get source icon component.
 */
function SourceIcon({ source }) {
  if (source === 'online') {
    return <Clock size={14} aria-hidden="true" />;
  }
  return <Cpu size={14} aria-hidden="true" />;
}

/**
 * GameHistoryPanel — Browse and replay saved games.
 */
const GameHistoryPanel = ({ onClose, onReplay }) => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();

  const loadGames = useCallback(async () => {
    setLoading(true);
    const data = await getGames({ limit: 100 });
    setGames(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const handleReplay = useCallback((game) => {
    if (onReplay) {
      onReplay(game);
    } else {
      // Navigate to analysis with the game PGN
      const pgnEncoded = encodeURIComponent(game.pgn);
      navigate(`/analysis?pgn=${pgnEncoded}`);
    }
  }, [onReplay, navigate]);

  const handleDelete = useCallback(async (id) => {
    setDeleting(id);
    const ok = await deleteGame(id);
    if (ok) {
      setGames(prev => prev.filter(g => g.id !== id));
      toast.success('Game deleted from history');
    } else {
      toast.error('Failed to delete game');
    }
    setDeleting(null);
  }, []);

  // ── Empty state ──
  if (!loading && games.length === 0) {
    return (
      <div className="gh-panel">
        <div className="gh-empty">
          <div className="gh-empty-icon" aria-hidden="true">📜</div>
          <h3>No Games Yet</h3>
          <p>Your completed games will appear here automatically.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gh-panel">
      <div className="gh-header">
        <h3 className="gh-title">Game History</h3>
        {games.length > 0 && (
          <span className="gh-count">{games.length} game{games.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading ? (
        <div className="gh-loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="gh-skeleton" />
          ))}
        </div>
      ) : (
        <div className="gh-list" role="list" aria-label="Saved games">
          {games.map(game => (
            <div key={game.id} className="gh-item" role="listitem">
              <button
                className="gh-item-main"
                onClick={() => handleReplay(game)}
                title="Replay this game"
              >
                <div className="gh-item-top">
                  <span className="gh-source">
                    <SourceIcon source={game.source} />
                    {game.source === 'online' ? 'Online' : 'Analysis'}
                  </span>
                  <span className="gh-date">{formatDate(game.created_at)}</span>
                </div>
                <div className="gh-item-bottom">
                  <span className="gh-result">
                    {resultLabel(game.result) || 'In progress'}
                    {game.result?.reason && (
                      <span className="gh-reason"> ({game.result.reason})</span>
                    )}
                  </span>
                  <span className="gh-moves">{formatMoves(game.move_count)}</span>
                  <span className="gh-replay-icon">
                    <Play size={12} /> Replay <ChevronRight size={14} />
                  </span>
                </div>
              </button>
              <button
                className="gh-delete-btn"
                onClick={() => handleDelete(game.id)}
                disabled={deleting === game.id}
                title="Delete this game"
                aria-label={`Delete game from ${formatDate(game.created_at)}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameHistoryPanel;
