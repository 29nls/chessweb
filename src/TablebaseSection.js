import React from 'react';
import './TablebaseSection.css';

const TablebaseSection = ({ tablebaseData, isLoading, boardOrientation }) => {
  if (!tablebaseData || tablebaseData.error) {
    return null;
  }

  const { moves, mainline, checkmate, stalemate } = tablebaseData;

  // Don't display if no moves available
  if (!moves || moves.length === 0) {
    return null;
  }

  /**
   * Calculate WDL percentages
   */
  const calculateWdlPercentage = (wdl) => {
    const total = (wdl.wins || 0) + (wdl.draws || 0) + (wdl.losses || 0);
    if (total === 0) return { winPct: 0, drawPct: 0, lossPct: 0 };

    return {
      winPct: ((wdl.wins || 0) / total) * 100,
      drawPct: ((wdl.draws || 0) / total) * 100,
      lossPct: ((wdl.losses || 0) / total) * 100,
    };
  };

  /**
   * Determine move classification based on WDL
   */
  const getMoveClassification = (wdl) => {
    const total = (wdl.wins || 0) + (wdl.draws || 0) + (wdl.losses || 0);
    if (total === 0) return 'neutral';

    const winPct = (wdl.wins || 0) / total;
    const drawPct = (wdl.draws || 0) / total;

    if (winPct > 0.5) return 'winning';
    if (drawPct > 0.5) return 'drawing';
    return 'losing';
  };

  /**
   * Format DTM (Distance to Mate) if available
   */
  const formatDtm = (dtm) => {
    if (!dtm) return null;
    return dtm > 0 ? `M+${dtm}` : `M${dtm}`;
  };

  // Sort moves by WDL (best first)
  const sortedMoves = [...moves].sort((a, b) => {
    const aPct = calculateWdlPercentage(a.wdl).winPct;
    const bPct = calculateWdlPercentage(b.wdl).winPct;
    return bPct - aPct;
  });

  // Show top 5 moves
  const displayMoves = sortedMoves.slice(0, 5);

  return (
    <div className="tablebase-section panel">
      <div className="tablebase-header">
        <h3>🎯 Tablebase (Endgame)</h3>
        {isLoading && <div className="tablebase-loading">Loading...</div>}
      </div>

      {checkmate && (
        <div className="tablebase-status">
          <span className="badge badge-checkmate">♔ Checkmate</span>
        </div>
      )}
      {stalemate && (
        <div className="tablebase-status">
          <span className="badge badge-stalemate">⊗ Stalemate</span>
        </div>
      )}

      <div className="tablebase-moves">
        <table className="moves-table">
          <thead>
            <tr>
              <th className="col-move">Move</th>
              <th className="col-class">Class</th>
              <th className="col-wdl">Win %</th>
              <th className="col-wdl">Draw %</th>
              <th className="col-wdl">Loss %</th>
              <th className="col-dtm">DTM</th>
            </tr>
          </thead>
          <tbody>
            {displayMoves.map((move, idx) => {
              const wdlPct = calculateWdlPercentage(move.wdl);
              const classification = getMoveClassification(move.wdl);
              const dtm = formatDtm(move.dtm);

              return (
                <tr key={idx} className={`move-row move-${classification}`}>
                  <td className="col-move">
                    <span className="move-san">{move.san}</span>
                  </td>
                  <td className="col-class">
                    <span className={`classification ${classification}`}>
                      {classification === 'winning' && '✓ Win'}
                      {classification === 'drawing' && '= Draw'}
                      {classification === 'losing' && '✗ Loss'}
                    </span>
                  </td>
                  <td className="col-wdl">
                    <span className="wdl-value win">{wdlPct.winPct.toFixed(0)}%</span>
                  </td>
                  <td className="col-wdl">
                    <span className="wdl-value draw">{wdlPct.drawPct.toFixed(0)}%</span>
                  </td>
                  <td className="col-wdl">
                    <span className="wdl-value loss">{wdlPct.lossPct.toFixed(0)}%</span>
                  </td>
                  <td className="col-dtm">{dtm || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mainline && mainline.length > 0 && (
        <div className="tablebase-mainline">
          <h4>Optimal Continuation</h4>
          <div className="mainline-moves">
            {mainline.slice(0, 10).map((move, idx) => (
              <span key={idx} className="move-badge">
                {idx + 1}. {move}
              </span>
            ))}
            {mainline.length > 10 && <span className="move-badge">...</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TablebaseSection;
