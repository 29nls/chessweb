import React from 'react';
import { detectOpening, getCommonNextMoves } from '../lib/openings';
import './OpeningExplorer.css';

export default function OpeningExplorer({ moves }) {
  const opening = detectOpening(moves);
  const commonNext = getCommonNextMoves(moves);

  return (
    <div className="opening-explorer">
      <div className="opening-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
          <path d="M2 12h20"/>
        </svg>
        Opening
      </div>

      {opening ? (
        <>
          <div className="opening-name">{opening.name}</div>
          <div className="opening-eco">ECO: {opening.eco}</div>
        </>
      ) : (
        moves && moves.length > 0 ? (
          <div className="opening-empty">Unrecognized position</div>
        ) : (
          <div className="opening-empty">Make a move to identify the opening</div>
        )
      )}

      {commonNext.length > 0 && (
        <div className="opening-next-moves">
          <div className="opening-next-header">Common next moves:</div>
          {commonNext.map(({ move, count }) => (
            <div key={move} className="opening-next-item">
              <span className="opening-next-move">{move}</span>
              <span className="opening-next-count">{count}x</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
