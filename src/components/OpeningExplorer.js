import React from 'react';
import { detectOpening, getCommonNextMoves } from '../lib/openings';

const containerStyle = {
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '10px',
  padding: '15px',
  boxShadow: '0 2px 8px var(--shadow-color)',
  fontSize: '0.9em',
};

const titleStyle = {
  fontSize: '1em',
  fontWeight: 600,
  color: 'var(--text-primary)',
  margin: '0 0 10px 0',
  paddingBottom: '8px',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const nameStyle = {
  fontSize: '1.1em',
  fontWeight: 700,
  color: 'var(--accent-primary)',
};

const ecoStyle = {
  fontSize: '0.85em',
  color: 'var(--text-secondary)',
  marginTop: '4px',
};

const nextMovesStyle = {
  marginTop: '12px',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '10px',
};

const nextMoveItemStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '4px 0',
  fontSize: '0.9em',
  fontFamily: "'Noto Chess', 'Segoe UI', monospace",
};

const emptyStyle = {
  color: 'var(--text-secondary)',
  fontSize: '0.9em',
  fontStyle: 'italic',
};

export default function OpeningExplorer({ moves }) {
  const opening = detectOpening(moves);
  const commonNext = getCommonNextMoves(moves);

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
          <path d="M2 12h20"/>
        </svg>
        Opening
      </div>

      {opening ? (
        <>
          <div style={nameStyle}>{opening.name}</div>
          <div style={ecoStyle}>ECO: {opening.eco}</div>
        </>
      ) : (
        moves && moves.length > 0 ? (
          <div style={emptyStyle}>Unrecognized position</div>
        ) : (
          <div style={emptyStyle}>Make a move to identify the opening</div>
        )
      )}

      {commonNext.length > 0 && (
        <div style={nextMovesStyle}>
          <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Common next moves:
          </div>
          {commonNext.map(({ move, count }) => (
            <div key={move} style={nextMoveItemStyle}>
              <span style={{ color: 'var(--text-primary)' }}>{move}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85em' }}>{count}x</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
