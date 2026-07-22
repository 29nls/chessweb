import React, { useState, useEffect, useRef } from 'react';

const PIECE_LIST = ['♔', '♕', '♖', '♗', '♘', '♙'];

// ── Reusable Shimmer Bar ──
export const ShimmerBlock = ({ width, height, borderRadius = '0.75rem', className = '' }) => (
  <div
    className={`animate-shimmer ${className}`}
    style={{ width, height, borderRadius }}
    aria-hidden="true"
  />
);

// ── Chess Piece Carousel ──
// Cycles through chess pieces with unique entrance animations per piece type
const ChessPieceCarousel = ({ activeIndex = 0 }) => {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef(null);

  // Advance through pieces every 1.8s, or jump to activeIndex if it changes
  useEffect(() => {
    const target = activeIndex % PIECE_LIST.length;
    if (target !== displayIndex) {
      setIsTransitioning(true);
      const t = setTimeout(() => {
        setDisplayIndex(target);
        setIsTransitioning(false);
      }, 600);
      return () => clearTimeout(t);
    }

    // Auto-advance timer
    timerRef.current = setInterval(() => {
      setDisplayIndex((p) => {
        const next = (p + 1) % PIECE_LIST.length;
        setIsTransitioning(true);
        setTimeout(() => setIsTransitioning(false), 600);
        return next;
      });
    }, 2200);

    return () => clearInterval(timerRef.current);
  }, [activeIndex, displayIndex]);

  const currentPiece = PIECE_LIST[displayIndex];

  // Determine piece type class for unique animation
  const pieceTypeClass = (() => {
    switch (currentPiece) {
      case '♔': return 'cp-king';
      case '♕': return 'cp-queen';
      case '♖': return 'cp-rook';
      case '♗': return 'cp-bishop';
      case '♘': return 'cp-knight';
      case '♙': return 'cp-pawn';
      default: return 'cp-pawn';
    }
  })();

  return (
    <div className="sk-cp-carousel" aria-hidden="true">
      <div className={`sk-cp-icon ${pieceTypeClass} ${isTransitioning ? 'cp-entering' : 'cp-idle'}`}>
        <span className="sk-cp-piece">{currentPiece}</span>
        <div className="sk-cp-glow" />
      </div>
    </div>
  );
};

// ── Piece Step Indicator ──
// Uses miniature chess pieces instead of generic dots
const STEP_PIECES = ['♙', '♘', '♗', '♖', '♕', '♔'];

export const PieceStepIndicator = ({ steps, currentIndex }) => (
  <div className="sk-pieces-steps" aria-hidden="true">
    {steps.map((s, i) => {
      const pieceChar = STEP_PIECES[i % STEP_PIECES.length];
      const isCurrent = i === currentIndex;
      const isDone = i <= currentIndex;

      return (
        <div
          key={s.section}
          className={`sk-ps-step ${isDone ? 'ps-done' : ''} ${isCurrent ? 'ps-current' : ''}`}
        >
          <div className={`sk-ps-dot ${isDone ? 'ps-dot-done' : ''} ${isCurrent ? 'ps-dot-current' : ''}`}>
            {isDone ? (
              <span className="sk-ps-piece">{pieceChar}</span>
            ) : (
              <span className="sk-ps-empty" />
            )}
          </div>
          <span className="sk-ps-label">{s.label}</span>
        </div>
      );
    })}
  </div>
);

// ── Progress Bar with chess piece logo ──
export const StepProgressBar = ({ pct, label, stepIndex = 0 }) => (
  <div className="sk-progress-row">
    <ChessPieceCarousel activeIndex={stepIndex} />
    <div className="sk-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="sk-progress-fill" style={{ width: `${pct}%` }} />
      <span className="sk-progress-label">{label}</span>
    </div>
  </div>
);

// ── Board Skeleton with floating chess pieces ──
export const BoardSkeleton = () => (
  <div
    className="sk-board-enchanted"
    aria-busy="true"
    aria-label="Loading chessboard"
  >
    {/* Chessboard pattern background */}
    <div className="sk-board-bg" />

    {/* Floating pieces that drift with personality */}
    <div className="sk-board-pieces">
      <span className="sk-bp sk-bp-king" aria-hidden="true">♔</span>
      <span className="sk-bp sk-bp-queen" aria-hidden="true">♕</span>
      <span className="sk-bp sk-bp-rook" aria-hidden="true">♖</span>
      <span className="sk-bp sk-bp-bishop" aria-hidden="true">♗</span>
      <span className="sk-bp sk-bp-knight" aria-hidden="true">♘</span>
      <span className="sk-bp sk-bp-pawn" aria-hidden="true">♙</span>

      {/* Black pieces */}
      <span className="sk-bp sk-bp-bk" aria-hidden="true">♚</span>
      <span className="sk-bp sk-bp-bq" aria-hidden="true">♛</span>
      <span className="sk-bp sk-bp-br" aria-hidden="true">♜</span>
      <span className="sk-bp sk-bp-bb" aria-hidden="true">♝</span>
      <span className="sk-bp sk-bp-bn" aria-hidden="true">♞</span>
      <span className="sk-bp sk-bp-bp2" aria-hidden="true">♟</span>
    </div>

    {/* Shimmer overlay */}
    <div className="sk-board-shimmer" />
  </div>
);

// ── Panel Skeleton ──
export const PanelSkeleton = () => (
  <div
    className="skeleton animate-pulse"
    style={{ height: '300px', width: '100%', borderRadius: '10px' }}
    aria-busy="true"
    aria-label="Loading panel"
  />
);

// ── Move History Skeleton ──
export const MoveHistorySkeleton = () => (
  <div
    className="skeleton animate-pulse"
    style={{ height: '200px', width: '100%', borderRadius: '10px' }}
    aria-busy="true"
    aria-label="Loading move history"
  />
);

// ── Opening Explorer Skeleton ──
export const OpeningExplorerSkeleton = () => (
  <div className="opening-explorer" aria-label="Loading opening explorer" aria-busy="true">
    {/* Title row */}
    <div className="opening-title">
      <div className="animate-shimmer" style={{ width: '16px', height: '16px', borderRadius: '50%' }} aria-hidden="true" />
      <ShimmerBlock width="60px" height="14px" borderRadius="4px" />
    </div>

    {/* Opening name */}
    <ShimmerBlock width="200px" height="18px" borderRadius="4px" />
    <div style={{ marginTop: '4px' }}>
      <ShimmerBlock width="80px" height="12px" borderRadius="4px" />
    </div>

    {/* Next moves list */}
    <div className="opening-next-moves">
      <ShimmerBlock width="140px" height="12px" borderRadius="4px" />
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div className="opening-next-item">
          <ShimmerBlock width="40px" height="14px" borderRadius="3px" />
          <ShimmerBlock width="30px" height="12px" borderRadius="3px" />
        </div>
        <div className="opening-next-item">
          <ShimmerBlock width="35px" height="14px" borderRadius="3px" />
          <ShimmerBlock width="25px" height="12px" borderRadius="3px" />
        </div>
        <div className="opening-next-item">
          <ShimmerBlock width="45px" height="14px" borderRadius="3px" />
          <ShimmerBlock width="20px" height="12px" borderRadius="3px" />
        </div>
      </div>
    </div>
  </div>
);

// ── Game Review Skeleton (modal content) ──
export const GameReviewSkeleton = () => (
  <div className="game-review-card" aria-label="Loading game review" aria-busy="true">
    {/* Title */}
    <div style={{ textAlign: 'center', marginBottom: '4px' }}>
      <ShimmerBlock width="140px" height="22px" borderRadius="6px" className="mx-auto" />
    </div>
    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
      <ShimmerBlock width="120px" height="14px" borderRadius="4px" className="mx-auto" />
    </div>

    {/* Accuracy cards */}
    <div className="accuracy-section">
      <div className="accuracy-card">
        <ShimmerBlock width="50px" height="12px" borderRadius="4px" className="mx-auto" />
        <div style={{ marginTop: '8px' }}>
          <ShimmerBlock width="60px" height="32px" borderRadius="6px" className="mx-auto" />
        </div>
        <div style={{ marginTop: '4px' }}>
          <ShimmerBlock width="50px" height="12px" borderRadius="4px" className="mx-auto" />
        </div>
      </div>
      <div className="accuracy-card">
        <ShimmerBlock width="50px" height="12px" borderRadius="4px" className="mx-auto" />
        <div style={{ marginTop: '8px' }}>
          <ShimmerBlock width="60px" height="32px" borderRadius="6px" className="mx-auto" />
        </div>
        <div style={{ marginTop: '4px' }}>
          <ShimmerBlock width="50px" height="12px" borderRadius="4px" className="mx-auto" />
        </div>
      </div>
    </div>

    {/* Breakdown header */}
    <div className="breakdown-section">
      <ShimmerBlock width="120px" height="13px" borderRadius="4px" />
      <div className="breakdown-grid" style={{ marginTop: '12px' }}>
        <div>
          <ShimmerBlock width="50px" height="13px" borderRadius="4px" />
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <ShimmerBlock width="100%" height="12px" borderRadius="3px" />
            <ShimmerBlock width="80%" height="12px" borderRadius="3px" />
            <ShimmerBlock width="60%" height="12px" borderRadius="3px" />
          </div>
        </div>
        <div>
          <ShimmerBlock width="50px" height="13px" borderRadius="4px" />
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <ShimmerBlock width="100%" height="12px" borderRadius="3px" />
            <ShimmerBlock width="80%" height="12px" borderRadius="3px" />
            <ShimmerBlock width="60%" height="12px" borderRadius="3px" />
          </div>
        </div>
      </div>
    </div>

    {/* Action buttons */}
    <div className="game-review-actions">
      <ShimmerBlock width="100px" height="40px" borderRadius="10px" />
      <ShimmerBlock width="120px" height="40px" borderRadius="10px" />
    </div>
  </div>
);

// ── Analysis Page Skeleton ──
const ANALYSIS_STEPS = [
  { label: 'Mempersiapkan engine…', pct: 20, section: 'engine' },
  { label: 'Memuat papan catur…', pct: 45, section: 'board' },
  { label: 'Mengaktifkan evaluasi…', pct: 70, section: 'eval' },
  { label: 'Siap bermain!', pct: 95, section: 'ready' },
];

export const AnalysisSkeleton = ({ stepIndex }) => {
  const current = ANALYSIS_STEPS[Math.min(stepIndex, ANALYSIS_STEPS.length - 1)];
  const activeSection = current?.section ?? '';

  return (
    <div className="App" aria-label="Loading Analysis page" aria-busy="true">
      <main className="App-body">
        <div className="sk-body-loading">
          <StepProgressBar pct={current?.pct ?? 0} label={current?.label ?? ''} stepIndex={stepIndex} />
          <PieceStepIndicator steps={ANALYSIS_STEPS} currentIndex={stepIndex} />
        </div>

        <div className={`sk-section ${activeSection === 'eval' || activeSection === 'ready' ? 'sk-section-active' : ''}`} style={{ gridArea: 'evaluation' }}>
          <PanelSkeleton />
        </div>

        <div className={`sk-section ${activeSection === 'board' || activeSection === 'ready' ? 'sk-section-active' : ''}`} style={{ gridArea: 'chessboard' }}>
          <BoardSkeleton />
        </div>

        <div className={`sk-section ${activeSection === 'engine' || activeSection === 'ready' ? 'sk-section-active' : ''}`} style={{ gridArea: 'controls' }}>
          <div className="control-section">
            <ShimmerBlock width="120px" height="18px" borderRadius="6px" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <ShimmerBlock width="100%" height="36px" borderRadius="6px" />
              <ShimmerBlock width="100%" height="36px" borderRadius="6px" />
              <ShimmerBlock width="80%" height="36px" borderRadius="6px" />
            </div>
          </div>
        </div>

        <div className={`sk-section ${activeSection === 'eval' || activeSection === 'ready' ? 'sk-section-active' : ''}`} style={{ gridArea: 'opening' }}>
          <OpeningExplorerSkeleton />
        </div>

        <div className={`sk-section ${activeSection === 'ready' ? 'sk-section-active' : ''}`} style={{ gridArea: 'movehistory' }}>
          <MoveHistorySkeleton />
        </div>
      </main>
    </div>
  );
};

// ── Online Page Skeleton ──
const ONLINE_STEPS = [
  { label: 'Menyambung ke server…', pct: 25, section: 'connect' },
  { label: 'Menyiapkan pertandingan…', pct: 50, section: 'game' },
  { label: 'Memuat papan…', pct: 75, section: 'board' },
  { label: 'Siap bertanding!', pct: 95, section: 'ready' },
];

export const OnlineSkeleton = ({ stepIndex }) => {
  const current = ONLINE_STEPS[Math.min(stepIndex, ONLINE_STEPS.length - 1)];
  const activeSection = current?.section ?? '';

  return (
    <div className="App" aria-label="Loading Online page" aria-busy="true">
      <main className="App-body online-mode">
        <div className="sk-body-loading">
          <StepProgressBar pct={current?.pct ?? 0} label={current?.label ?? ''} stepIndex={stepIndex} />
          <PieceStepIndicator steps={ONLINE_STEPS} currentIndex={stepIndex} />
        </div>

        {/* Status bar skeleton */}
        <div className={`sk-section ${activeSection === 'connect' || activeSection === 'ready' ? 'sk-section-active' : ''}`}>
          <div className="sk-online-status">
            <ShimmerBlock width="60px" height="20px" borderRadius="10px" />
            <ShimmerBlock width="140px" height="14px" borderRadius="6px" />
            <ShimmerBlock width="80px" height="28px" borderRadius="6px" />
          </div>
        </div>

        {/* Board skeleton */}
        <div className={`sk-section ${activeSection === 'board' || activeSection === 'ready' ? 'sk-section-active' : ''}`}>
          <BoardSkeleton />
        </div>
      </main>
    </div>
  );
};

// ── History Page Skeleton ──
const HISTORY_STEPS = [
  { label: 'Memuat riwayat…', pct: 25, section: 'load' },
  { label: 'Mengumpulkan data…', pct: 50, section: 'data' },
  { label: 'Menyusun daftar…', pct: 75, section: 'list' },
  { label: 'Siap melihat!', pct: 95, section: 'ready' },
];

export const HistorySkeleton = ({ stepIndex }) => {
  const current = HISTORY_STEPS[Math.min(stepIndex, HISTORY_STEPS.length - 1)];
  const activeSection = current?.section ?? '';

  return (
    <div className="App" aria-label="Loading History page" aria-busy="true">
      <main className="App-body">
        <div className="sk-body-loading">
          <StepProgressBar pct={current?.pct ?? 0} label={current?.label ?? ''} stepIndex={stepIndex} />
          <PieceStepIndicator steps={HISTORY_STEPS} currentIndex={stepIndex} />
        </div>

        {/* ── History skeleton content ── */}
        <div className="history-page">
          {/* Header skeleton */}
          <div className={`sk-history-header ${activeSection === 'load' || activeSection === 'data' || activeSection === 'ready' ? 'sk-section-active' : ''}`}>
            <ShimmerBlock width="40px" height="40px" borderRadius="10px" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <ShimmerBlock width="180px" height="22px" borderRadius="6px" />
              <ShimmerBlock width="240px" height="14px" borderRadius="5px" />
            </div>
            <ShimmerBlock width="56px" height="56px" borderRadius="14px" />
          </div>

          {/* Game list skeleton */}
          <div className="sk-history-list">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`sk-history-row ${activeSection === 'data' || activeSection === 'list' || activeSection === 'ready' ? 'sk-section-active' : ''}`}>
                <ShimmerBlock width="36px" height="36px" borderRadius="10px" />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <ShimmerBlock width="140px" height="16px" borderRadius="5px" />
                  <ShimmerBlock width="200px" height="12px" borderRadius="4px" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                  <ShimmerBlock width="50px" height="16px" borderRadius="4px" />
                  <ShimmerBlock width="80px" height="12px" borderRadius="4px" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

// ── Puzzle Page Skeleton ──
const PUZZLE_STEPS = [
  { label: 'Memuat puzzle…', pct: 25, section: 'load' },
  { label: 'Menyiapkan papan…', pct: 50, section: 'board' },
  { label: 'Menganalisis posisi…', pct: 75, section: 'analysis' },
  { label: 'Siap berlatih!', pct: 95, section: 'ready' },
];

export const PuzzleSkeleton = ({ stepIndex }) => {
  const current = PUZZLE_STEPS[Math.min(stepIndex, PUZZLE_STEPS.length - 1)];
  const activeSection = current?.section ?? '';

  return (
    <div className="App" aria-label="Loading Puzzle page" aria-busy="true">
      <main className="App-body puzzle-mode">
        <div className="sk-body-loading">
          <StepProgressBar pct={current?.pct ?? 0} label={current?.label ?? ''} stepIndex={stepIndex} />
          <PieceStepIndicator steps={PUZZLE_STEPS} currentIndex={stepIndex} />
        </div>

        {/* Info panel skeleton */}
        <div className={`sk-section ${activeSection === 'load' || activeSection === 'ready' ? 'sk-section-active' : ''}`} style={{ gridArea: 'evaluation' }}>
          <div className="sk-puzzle-info">
            <ShimmerBlock width="120px" height="18px" borderRadius="6px" />
            <ShimmerBlock width="80px" height="14px" borderRadius="6px" />
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <ShimmerBlock width="50px" height="20px" borderRadius="4px" />
              <ShimmerBlock width="40px" height="20px" borderRadius="4px" />
              <ShimmerBlock width="60px" height="20px" borderRadius="4px" />
            </div>
            <ShimmerBlock width="100%" height="12px" borderRadius="5px" />
            <ShimmerBlock width="90%" height="12px" borderRadius="5px" />
            <div className="sk-puzzle-stats">
              <ShimmerBlock width="100%" height="60px" borderRadius="8px" />
              <ShimmerBlock width="100%" height="60px" borderRadius="8px" />
              <ShimmerBlock width="100%" height="60px" borderRadius="8px" />
            </div>
          </div>
        </div>

        {/* Board skeleton */}
        <div className={`sk-section ${activeSection === 'board' || activeSection === 'ready' ? 'sk-section-active' : ''}`} style={{ gridArea: 'chessboard' }}>
          <BoardSkeleton />
        </div>

        {/* Solution panel skeleton */}
        <div className={`sk-section ${activeSection === 'analysis' || activeSection === 'ready' ? 'sk-section-active' : ''}`} style={{ gridArea: 'controls' }}>
          <div className="sk-puzzle-solution">
            <ShimmerBlock width="80px" height="16px" borderRadius="6px" />
            <ShimmerBlock width="100%" height="24px" borderRadius="6px" />
            <ShimmerBlock width="100%" height="24px" borderRadius="6px" />
            <ShimmerBlock width="100%" height="24px" borderRadius="6px" />
            <ShimmerBlock width="70%" height="24px" borderRadius="6px" />
          </div>
        </div>
      </main>
    </div>
  );
};
