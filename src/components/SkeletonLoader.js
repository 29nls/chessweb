import React from 'react';

const checkerboardPattern = {
  backgroundImage: 'linear-gradient(45deg, var(--border-color) 25%, transparent 25%), linear-gradient(-45deg, var(--border-color) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--border-color) 75%), linear-gradient(-45deg, transparent 75%, var(--border-color) 75%)',
  backgroundSize: '20px 20px',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
};

export const BoardSkeleton = () => (
  <div
    className="animate-pulse"
    style={{
      width: '100%',
      aspectRatio: '1/1',
      borderRadius: '6px',
      backgroundColor: 'var(--bg-tertiary)',
      ...checkerboardPattern,
      opacity: 0.6,
    }}
    aria-busy="true"
    aria-label="Loading chessboard"
  >
    {/* Chess piece silhouettes */}
    <div style={{
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      height: '100%',
      fontSize: 'clamp(2rem, 8vw, 5rem)',
      color: 'var(--text-secondary)',
      opacity: 0.2,
    }}>
      <span>♔</span>
      <span>♕</span>
      <span>♖</span>
      <span>♗</span>
      <span>♘</span>
    </div>
  </div>
);

export const PanelSkeleton = () => (
  <div
    className="skeleton animate-pulse"
    style={{ height: '300px', width: '100%', borderRadius: '10px' }}
    aria-busy="true"
    aria-label="Loading panel"
  />
);

export const MoveHistorySkeleton = () => (
  <div
    className="skeleton animate-pulse"
    style={{ height: '200px', width: '100%', borderRadius: '10px' }}
    aria-busy="true"
    aria-label="Loading move history"
  />
);
