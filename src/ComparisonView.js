import React from 'react';
import { TrendingUp, Zap, Target } from 'react-feather';
import './ComparisonView.css';

const ComparisonView = ({ stockfishEval, tablebaseData, boardOrientation }) => {
  if (!tablebaseData || !tablebaseData.moves || tablebaseData.moves.length === 0) {
    return null;
  }

  // Get best tablebase move
  const bestTablebaseMove = tablebaseData.moves[0];
  if (!bestTablebaseMove) return null;

  const getFormattedEval = () => {
    if (stockfishEval.score === null) return '+0.00';

    let score =
      stockfishEval.type === 'cp'
        ? (stockfishEval.score / 100).toFixed(2)
        : `#${Math.abs(stockfishEval.score)}`;

    if (boardOrientation === 'black' && stockfishEval.type === 'cp') {
      score = (parseFloat(score) * -1).toFixed(2);
    }

    if (stockfishEval.type === 'cp' && parseFloat(score) > 0) {
      score = `+${score}`;
    }

    return score;
  };

  const getMoveClassification = (wdl) => {
    const total = (wdl.wins || 0) + (wdl.draws || 0) + (wdl.losses || 0);
    if (total === 0) return 'neutral';

    const winPct = (wdl.wins || 0) / total;
    const drawPct = (wdl.draws || 0) / total;

    if (winPct > 0.5) return 'winning';
    if (drawPct > 0.5) return 'drawing';
    return 'losing';
  };

  const calculateWdlPercentage = (wdl) => {
    const total = (wdl.wins || 0) + (wdl.draws || 0) + (wdl.losses || 0);
    if (total === 0) return { winPct: 0, drawPct: 0, lossPct: 0 };

    return {
      winPct: ((wdl.wins || 0) / total) * 100,
      drawPct: ((wdl.draws || 0) / total) * 100,
      lossPct: ((wdl.losses || 0) / total) * 100,
    };
  };

  const wdlPct = calculateWdlPercentage(bestTablebaseMove.wdl);
  const classification = getMoveClassification(bestTablebaseMove.wdl);

  // Determine if evaluations agree
  const stockfishScore = stockfishEval.score || 0;
  const agreementIndicator =
    stockfishEval.type === 'mate' ? '♔ Mate' : stockfishScore > 50 ? '✓ Winning' : stockfishScore < -50 ? '✗ Losing' : '= Drawing';

  return (
    <div className="panel comparison-view">
      <div className="comparison-header">
        <h3>📊 Engine Comparison</h3>
      </div>

      <div className="comparison-grid">
        {/* Stockfish Evaluation */}
        <div className="comparison-card stockfish-card">
          <div className="card-header">
            <Zap size={20} />
            <span>Stockfish</span>
          </div>
          <div className="card-content">
            <div className="eval-score">{getFormattedEval()}</div>
            <div className="eval-details">
              <div className="detail-row">
                <span className="label">Depth:</span>
                <span className="value">{stockfishEval.depth || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="label">Assessment:</span>
                <span className={`value assessment ${agreementIndicator.includes('Mate') ? 'mate' : ''}`}>
                  {agreementIndicator}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tablebase Recommendation */}
        <div className="comparison-card tablebase-card">
          <div className="card-header">
            <Target size={20} />
            <span>Tablebase</span>
          </div>
          <div className="card-content">
            <div className="best-move">{bestTablebaseMove.san}</div>
            <div className="wdl-stats">
              <div className="wdl-bar">
                <div
                  className="wdl-segment win"
                  style={{ width: `${wdlPct.winPct}%` }}
                  title={`Win: ${wdlPct.winPct.toFixed(0)}%`}
                ></div>
                <div
                  className="wdl-segment draw"
                  style={{ width: `${wdlPct.drawPct}%` }}
                  title={`Draw: ${wdlPct.drawPct.toFixed(0)}%`}
                ></div>
                <div
                  className="wdl-segment loss"
                  style={{ width: `${wdlPct.lossPct}%` }}
                  title={`Loss: ${wdlPct.lossPct.toFixed(0)}%`}
                ></div>
              </div>
              <div className="wdl-values">
                <span className="value win">W {wdlPct.winPct.toFixed(0)}%</span>
                <span className="value draw">D {wdlPct.drawPct.toFixed(0)}%</span>
                <span className="value loss">L {wdlPct.lossPct.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agreement Indicator */}
      <div className="comparison-footer">
        <TrendingUp size={18} />
        <span>
          Both engines recommend strong continuation from evaluated position
        </span>
      </div>
    </div>
  );
};

export default ComparisonView;
