import React from 'react';
import './SkeletonLoader.css'; // We'll create this if needed, or rely on index.css

export const BoardSkeleton = () => (
  <div className="skeleton animate-pulse" style={{ width: '100%', aspectRatio: '1/1' }} aria-busy="true" aria-label="Loading chessboard" />
);

export const PanelSkeleton = () => (
  <div className="skeleton animate-pulse" style={{ height: '300px', width: '100%' }} aria-busy="true" aria-label="Loading panel" />
);

export const MoveHistorySkeleton = () => (
  <div className="skeleton animate-pulse" style={{ height: '200px', width: '100%' }} aria-busy="true" aria-label="Loading move history" />
);
