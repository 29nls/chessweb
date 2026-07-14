import React from 'react';
import { List } from 'react-feather';
import './MoveHistory.css';

const MoveHistory = ({ moves, classifications }) => {
  // Group moves into pairs (White, Black) per row
  const moveRows = [];
  for (let i = 0; i < moves.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;
    const whiteMove = moves[i];
    const blackMove = moves[i + 1] || null;
    const whiteClass = classifications[i] || null;
    const blackClass = classifications[i + 1] || null;

    moveRows.push({
      number: moveNumber,
      white: { san: whiteMove, classification: whiteClass },
      black: blackMove ? { san: blackMove, classification: blackClass } : null,
    });
  }

  const renderBadge = (classification) => {
    if (!classification) return null;
    return (
      <span
        className="move-badge"
        style={{
          backgroundColor: classification.color + '22',
          color: classification.color,
          border: `1px solid ${classification.color}44`,
        }}
        title={classification.label}
      >
        {classification.icon && <span>{classification.icon}</span>}
        {classification.label}
      </span>
    );
  };

  if (moves.length === 0) {
    return (
      <div className="panel move-history-panel">
        <h3 className="move-history-title">
          <List size={18} />
          Move History
        </h3>
        <div className="empty-move">Make a move to start tracking</div>
      </div>
    );
  }

  return (
    <div className="panel move-history-panel">
      <h3 className="move-history-title">
        <List size={18} />
        Move History
      </h3>
        <div className="move-history-scroll" data-testid="move-list">
        <div className="move-row" style={{ fontWeight: 600, fontSize: '0.75em', color: 'var(--text-secondary)' }}>
          <div className="move-number">#</div>
          <div>White</div>
          <div>Black</div>
        </div>
        {moveRows.map((row) => (
          <div className="move-row" key={row.number}>
            <div className="move-number">{row.number}.</div>
            <div className="move-cell">
              <span className="move-san" data-testid="move-san">{row.white.san}</span>
              {renderBadge(row.white.classification)}
            </div>
            <div className="move-cell">
              {row.black ? (
                <>
                  <span className="move-san" data-testid="move-san">{row.black.san}</span>
                  {renderBadge(row.black.classification)}
                </>
              ) : (
                <span className="empty-move" style={{ padding: 0 }}>...</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MoveHistory;
