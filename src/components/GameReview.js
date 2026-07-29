import React from 'react';
import AccessibleDialog from '../AccessibleDialog';
import { computeAccuracyReport, LABELS } from '../MoveClassification';
import { GameReviewSkeleton } from './SkeletonLoader';
import './GameReview.css';

const LABEL_ORDER = ['Brilliant', 'Best', 'Great', 'Excellent', 'Good', 'Inaccuracy', 'Miss', 'Mistake', 'Blunder'];

const AccuracyCard = ({ side, accuracy, isWinner }) => {
  const sideLabel = side === 'white' ? 'White' : 'Black';
  let colorClass = 'good';
  let grade = 'Excellent';
  if (accuracy < 50) { colorClass = 'bad'; grade = 'Needs Work'; }
  else if (accuracy < 70) { colorClass = 'ok'; grade = 'Good'; }
  else if (accuracy < 85) { colorClass = 'good'; grade = 'Great'; }
  else { colorClass = 'good'; grade = 'Excellent'; }

  return (
    <div
      className={`accuracy-card ${accuracy < 50 ? 'low' : accuracy < 70 ? 'medium' : 'high'}`}
      role="region"
      aria-label={`${sideLabel} accuracy: ${accuracy} percent. ${isWinner ? 'Winner. ' : ''}${grade}`}
    >
      <div className="accuracy-side" aria-hidden="true">{sideLabel} {isWinner && '(Winner)'}</div>
      <div className={`accuracy-score ${colorClass}`} aria-live="polite" aria-atomic="true">{accuracy}%</div>
      <div className="accuracy-label" aria-hidden="true">{grade}</div>
    </div>
  );
};

const BreakdownCounts = ({ counts, sideLabel }) => {
  const entries = LABEL_ORDER
    .filter(key => counts[key] > 0)
    .map(key => ({ key, count: counts[key], color: LABELS[key]?.color || 'var(--text-secondary)', icon: LABELS[key]?.icon || '' }));

  if (entries.length === 0) {
    return (
      <div className="breakdown-side">
        <h4>{sideLabel}</h4>
        <div className="breakdown-empty">No classified moves</div>
      </div>
    );
  }

  return (
    <div className="breakdown-side" role="region" aria-label={`${sideLabel} move breakdown`}>
      <h4>{sideLabel}</h4>
      <ul aria-label={`${sideLabel} classified moves`}>
        {entries.map(({ key, count, color, icon }) => (
          <li key={key} className="breakdown-count">
            <span className="breakdown-label" style={{ color }}>
              {icon && <span aria-hidden="true">{icon}</span>}
              {key}
            </span>
            <span className="breakdown-num">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const GameReview = ({ isOpen, onClose, onNewGame, classifications, moves, result }) => {
  // Show skeleton while no classifications available yet, then render real content immediately
  if (!classifications || classifications.length === 0) {
    if (!isOpen) return null;
    return (
      <AccessibleDialog
        isOpen={isOpen}
        onClose={onClose}
        labelledBy="game-review-title"
        describedBy="game-review-subtitle"
        className="game-review-dialog"
      >
        <GameReviewSkeleton />
      </AccessibleDialog>
    );
  }

  const report = computeAccuracyReport(classifications, moves);
  const isDraw = result?.winner === 'draw';
  const whiteWon = result?.winner === 'white';
  const blackWon = result?.winner === 'black';

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="game-review-title"
      describedBy="game-review-subtitle"
      className="game-review-dialog"
    >
      <div className="game-review-card">
        <h2 id="game-review-title" className="game-review-title">Game Review</h2>
        <p className="game-review-subtitle">
          {isDraw ? 'Game ended in a draw' : whiteWon ? 'White wins!' : blackWon ? 'Black wins!' : 'Game complete'}
        </p>

        <div className="accuracy-section">
          <AccuracyCard side="white" accuracy={report.white.accuracy} isWinner={whiteWon} />
          <AccuracyCard side="black" accuracy={report.black.accuracy} isWinner={blackWon} />
        </div>

        <div className="breakdown-section">
          <div className="breakdown-title">Move Breakdown</div>
          <div className="breakdown-grid">
            <BreakdownCounts counts={report.white.counts} sideLabel="White" />
            <BreakdownCounts counts={report.black.counts} sideLabel="Black" />
          </div>
        </div>

        <div className="game-review-actions">
          <button type="button" className="button-secondary" onClick={onClose}>Close</button>
          <button type="button" className="button-primary" onClick={onNewGame}>New Game</button>
        </div>
      </div>
    </AccessibleDialog>
  );
};

export default GameReview;
