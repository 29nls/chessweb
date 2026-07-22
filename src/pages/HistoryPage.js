import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'react-feather';
import { useLoadingSequence } from '../hooks/useLoadingSequence';
import GameHistoryPanel from '../components/GameHistoryPanel';
import { HistorySkeleton } from '../components/SkeletonLoader';
import Modal from '../Modal';
import './HistoryPage.css';

/**
 * HistoryPage — Shows saved games with replay functionality.
 */
export default function HistoryPage() {
  const navigate = useNavigate();
  const [replayPgn, setReplayPgn] = React.useState(null);
  const { isLoading, showSkeleton, stepIndex, markReady } = useLoadingSequence({
    manual: true, // wait for GameHistoryPanel data to load
    stepCount: 4,
    stepTotalMs: 1000,
  });

  // Natural loading: dismiss skeleton once GameHistoryPanel confirms data is loaded
  const handleHistoryReady = useCallback(() => {
    markReady();
  }, [markReady]);

  const handleReplay = (game) => {
    if (game.pgn) {
      setReplayPgn(game.pgn);
    } else {
      // No PGN — open in analysis anyway
      navigate('/analysis');
    }
  };

  return (
    <div className="sk-transition-wrap">
      {/* ── Skeleton overlay ── */}
      {showSkeleton && (
        <div className={`sk-fade-layer ${!isLoading ? 'sk-fade-out' : ''}`}>
          <HistorySkeleton stepIndex={stepIndex} />
        </div>
      )}

      {/* ── Real content ── */}
      <div className={`sk-entering-content ${!isLoading ? 'sk-crossfade' : ''}`}>
        <div className="App">
          <main className="App-body history-page-layout">
        <div className="history-page">
          <header className="history-header">
            <button
              className="history-back-btn"
              onClick={() => navigate('/')}
              aria-label="Back to home"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="history-header-text">
              <h1 className="history-title">Game History</h1>
              <p className="history-subtitle">
                Browse and replay your completed games
              </p>
            </div>
            <div className="history-header-icon" aria-hidden="true">
              <Clock size={32} />
            </div>
          </header>

          <GameHistoryPanel onReplay={handleReplay} onReady={handleHistoryReady} />
        </div>
      </main>

      {/* Replay Modal — opens analysis page with PGN loaded */}
      {replayPgn && (
        <Modal isOpen={true} onClose={() => setReplayPgn(null)} title="Replay Game">
          <div className="replay-modal-content">
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.85em' }}>
              Open this game in Analysis Mode to replay it with Stockfish evaluation.
            </p>
            <div className="replay-actions">
              <button
                className="button-secondary"
                onClick={() => setReplayPgn(null)}
              >
                Cancel
              </button>
              <button
                className="button-primary"
                onClick={() => {
                  // Navigate to analysis with PGN in URL params
                  navigate(`/analysis?pgn=${encodeURIComponent(replayPgn)}`);
                }}
              >
                Open in Analysis
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
      </div>
    </div>
  );
}
