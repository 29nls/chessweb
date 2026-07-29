import React, { useMemo, useState } from 'react';
import { GitBranch, Search, X } from 'react-feather';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-scroll to the active row when it changes
  React.useEffect(() => {
    if (currentMoveIndex !== prevActiveRef.current && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      prevActiveRef.current = currentMoveIndex;
    }
  }, [currentMoveIndex]);

  const branchData = useBranchData(moves);

  // Build move rows from flat moves array
  const allMoveRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      rows.push({
        number: moveNumber,
        white: { san: moves[i], classification: classifications[i] || null, idx: i },
        black: moves[i + 1]
          ? { san: moves[i + 1], classification: classifications[i + 1] || null, idx: i + 1 }
          : null,
      });
    }
    return rows;
  }, [moves, classifications]);

  // Filter rows by search query
  const displayRows = useMemo(() => {
    if (!searchQuery.trim()) return allMoveRows;
    const q = searchQuery.toLowerCase();
    return allMoveRows.filter(row => {
      const wMatch = row.white.san.toLowerCase().includes(q);
      const wcMatch = row.white.classification?.label?.toLowerCase().includes(q);
      const bMatch = row.black?.san?.toLowerCase().includes(q);
      const bcMatch = row.black?.classification?.label?.toLowerCase().includes(q);
      return wMatch || wcMatch || bMatch || bcMatch;
    });
  }, [allMoveRows, searchQuery]);

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

  const renderAlternatives = (rowNumber, whiteIdx, blackIdx) => {
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
      <div className="move-alternatives" role="group" aria-label={`Alternative opening moves for move ${rowNumber}`}>
        {/* Tree branch connector */}
        <div className="alt-connector" aria-hidden="true" />
        <div className="alt-items" role="list">
          {allAlts.map((group) =>
            group.items.map((alt, ai) => (
              <span
                key={alt.move + '-' + group.type + '-' + ai}
                className="alt-chip"
                role="listitem"
                title={`Common alternative in opening book`}
                aria-label={`${alt.move}, common alternative`}
              >
                <span className="alt-move" aria-hidden="true">{alt.move}</span>
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
        {searchQuery.trim() && (
          <span className="move-search-count">
            {displayRows.length} / {allMoveRows.length} rows
          </span>
        )}
      </h3>

      {/* Search bar */}
      <div className="move-search-wrapper">
        <Search size={14} className="move-search-icon" />
        <input
          type="text"
          className="move-search-input"
          placeholder="Search moves (e4, Nf3, etc.)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search moves"
        />
        {searchQuery && (
          <button className="move-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      {displayRows.length === 0 && searchQuery.trim() ? (
        <div className="empty-move" role="status">No moves match &quot;{searchQuery}&quot;</div>
      ) : (
      <div className="move-history-scroll" data-testid="move-list" role="table" aria-label="Game explorer tree">
        <div className="move-row move-row-header" role="row">
          <div className="move-number" role="columnheader">#</div>
          <div role="columnheader">White</div>
          <div role="columnheader">Black</div>
        </div>
        {displayRows.map((row) => (
          <React.Fragment key={row.number}>
            {/* Main move row */}
            <div
              className={`move-row tree-main-row ${row.white.idx === currentMoveIndex ? 'move-row-active' : ''}`}
              role="row"
              ref={row.white.idx === currentMoveIndex ? scrollRef : null}
            >
              <div className="move-number" role="cell">{row.number}.</div>
              <div role="cell" className="move-cell-wrapper">
                <button
                  type="button"
                  className="move-cell move-cell-clickable"
                  aria-label={`Jump to move ${row.number} (white): ${row.white.san}`}
                  aria-current={row.white.idx === currentMoveIndex ? 'true' : undefined}
                  onClick={() => onJumpToMove?.(row.white.idx)}
                  tabIndex={row.white.idx === currentMoveIndex ? -1 : undefined}
                >
                  <span className="move-san">{row.white.san}</span>
                  {renderBadge(row.white.classification)}
                  {row.white.idx > 0 && renderOpeningLabel(row.white.idx + 1)}
                </button>
              </div>
              <div role="cell" className="move-cell-wrapper">
                {row.black ? (
                  <button
                    type="button"
                    className="move-cell move-cell-clickable"
                    aria-label={`Jump to move ${row.number} (black): ${row.black.san}`}
                    aria-current={row.black.idx === currentMoveIndex ? 'true' : undefined}
                    onClick={() => onJumpToMove?.(row.black.idx)}
                    tabIndex={row.black.idx === currentMoveIndex ? -1 : undefined}
                  >
                    <span className="move-san">{row.black.san}</span>
                    {renderBadge(row.black.classification)}
                    {renderOpeningLabel(row.black.idx + 1)}
                  </button>
                ) : (
                  <span className="empty-move" style={{ padding: 0 }}>...</span>
                )}
              </div>
            </div>
            {/* Alternatives row — shows tree branches from openings book */}
            {renderAlternatives(row.number, row.white.idx, row.black?.idx)}
          </React.Fragment>
        ))}
      </div>
      )}
    </div>
  );
};

export default MoveHistory;
