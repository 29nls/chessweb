import React, { useMemo } from 'react';
import { GitBranch } from 'react-feather';
import { getCommonNextMoves, detectOpening } from './lib/openings';
import './MoveHistory.css';

/**
 * Build branch data for each position in the game.
 * Returns an array parallel to moves where each entry has:
 *   alternatives – array of { move, count } from the opening book
 *   openingName  – the name of the opening matching the prefix up to this move
 *   openingEco   – ECO code for the opening
 */
function useBranchData(moves) {
  return useMemo(() => {
    const branches = [];
    for (let i = 0; i <= moves.length; i++) {
      const prefix = moves.slice(0, i);
      const nextMoves = getCommonNextMoves(prefix);
      const opening = detectOpening(prefix);
      // Filter out the actual move played at this position (if any)
      const alternatives = i < moves.length
        ? nextMoves.filter(m => m.move !== moves[i]).slice(0, 5)
        : nextMoves.slice(0, 5);
      branches.push({
        alternatives,
        openingName: opening?.name || null,
        openingEco: opening?.eco || null,
      });
    }
    return branches;
  }, [moves]);
}

const MoveHistory = ({ moves, classifications, currentMoveIndex = -1, onJumpToMove }) => {
  const scrollRef = React.useRef(null);
  const prevActiveRef = React.useRef(currentMoveIndex);

  // Auto-scroll to the active row when it changes
  React.useEffect(() => {
    if (currentMoveIndex !== prevActiveRef.current && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      prevActiveRef.current = currentMoveIndex;
    }
  }, [currentMoveIndex]);

  const branchData = useBranchData(moves);

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
      white: { san: whiteMove, classification: whiteClass, idx: i },
      black: blackMove ? { san: blackMove, classification: blackClass, idx: i + 1 } : null,
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

  const renderAlternatives = (whiteIdx, blackIdx) => {
    const whiteAlts = branchData[whiteIdx]?.alternatives || [];
    const blackAlts = blackIdx !== null ? (branchData[blackIdx]?.alternatives || []) : [];
    const allAlts = [];

    // For white move, show alternatives that were available at position whiteIdx
    // For black move, show alternatives available at position blackIdx
    if (whiteAlts.length > 0) {
      allAlts.push({ type: 'white', items: whiteAlts });
    }
    if (blackAlts.length > 0) {
      allAlts.push({ type: 'black', items: blackAlts });
    }

    if (allAlts.length === 0) return null;

    return (
      <div className="move-alternatives">
        {/* Tree branch connector */}
        <div className="alt-connector" />
        <div className="alt-items">
          {allAlts.map((group) =>
            group.items.map((alt, ai) => (
              <span key={alt.move + '-' + group.type + '-' + ai} className="alt-chip" title={`Common alternative in opening book`}>
                <span className="alt-move">{alt.move}</span>
              </span>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderOpeningLabel = (idx) => {
    const info = branchData[idx];
    if (!info?.openingName) return null;
    return (
      <span className="tree-opening-label" title={`ECO: ${info.openingEco || 'N/A'}`}>
        {info.openingName}
        {info.openingEco && <span className="tree-opening-eco">{info.openingEco}</span>}
      </span>
    );
  };

  if (moves.length === 0) {
    return (
      <div className="panel move-history-panel">
        <h3 className="move-history-title">
          <GitBranch size={18} />
          Game Explorer
        </h3>
        <div className="empty-move">Make a move to start tracking</div>
      </div>
    );
  }

  return (
    <div className="panel move-history-panel">
      <h3 className="move-history-title">
        <GitBranch size={18} />
        Game Explorer
      </h3>
      <div className="move-history-scroll" data-testid="move-list" role="list" aria-label="Game explorer tree">
        <div className="move-row move-row-header" role="row">
          <div className="move-number" role="columnheader">#</div>
          <div role="columnheader">White</div>
          <div role="columnheader">Black</div>
        </div>
        {moveRows.map((row) => (
          <React.Fragment key={row.number}>
            {/* Main move row */}
            <div
              className={`move-row tree-main-row ${row.white.idx === currentMoveIndex ? 'move-row-active' : ''}`}
              role="listitem"
              ref={row.white.idx === currentMoveIndex ? scrollRef : null}
            >
              <div className="move-number" role="cell">{row.number}.</div>
              <div
                className="move-cell move-cell-clickable"
                role="cell"
                onClick={() => onJumpToMove?.(row.white.idx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJumpToMove?.(row.white.idx); } }}
                tabIndex={row.white.idx === currentMoveIndex ? -1 : 0}
                aria-label={`Jump to move ${row.number}. ${row.white.san}`}
              >
                <span className="move-san">{row.white.san}</span>
                {renderBadge(row.white.classification)}
                {/* Opening label shown inline for the white move if it identifies a unique opening */}
                {row.white.idx > 0 && renderOpeningLabel(row.white.idx + 1)}
              </div>
              <div
                className={`move-cell ${row.black ? 'move-cell-clickable' : ''}`}
                role="cell"
                onClick={() => row.black && onJumpToMove?.(row.black.idx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.black && onJumpToMove?.(row.black.idx); } }}
                tabIndex={row.black && row.black.idx !== currentMoveIndex ? 0 : -1}
                aria-label={row.black ? `Jump to move ${row.number}... ${row.black.san}` : undefined}
              >
                {row.black ? (
                  <>
                    <span className="move-san">{row.black.san}</span>
                    {renderBadge(row.black.classification)}
                    {renderOpeningLabel(row.black.idx + 1)}
                  </>
                ) : (
                  <span className="empty-move" style={{ padding: 0 }}>...</span>
                )}
              </div>
            </div>
            {/* Alternatives row — shows tree branches from openings book */}
            {renderAlternatives(row.white.idx, row.black?.idx)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default MoveHistory;
