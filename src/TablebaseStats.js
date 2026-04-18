import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Trash2,
  Download
} from 'react-feather';
import { getSummary, getPopularEndgames, clearStats, exportStats } from '../utils/tablebaseStatsManager';
import './TablebaseStats.css';

const TablebaseStats = ({ isOpen, onClose }) => {
  const [summary, setSummary] = useState(null);
  const [popularEndgames, setPopularEndgames] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setSummary(getSummary());
      setPopularEndgames(getPopularEndgames(5));
    }
  }, [isOpen]);

  const handleClearStats = () => {
    if (window.confirm('Clear all tablebase statistics? This cannot be undone.')) {
      clearStats();
      setSummary(getSummary());
      setPopularEndgames(getPopularEndgames(5));
    }
  };

  const handleExportStats = () => {
    const data = exportStats();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tablebase-stats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !summary) {
    return null;
  }

  return (
    <div className="stats-modal-overlay" onClick={onClose}>
      <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stats-header">
          <h2>
            <BarChart3 size={24} />
            Tablebase Statistics
          </h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="stats-content">
          {/* Summary Section */}
          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-label">Total Queries</span>
              <span className="stat-value">{summary.totalQueries}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Positions Analyzed</span>
              <span className="stat-value">{summary.totalPositions}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Average Win Rate</span>
              <span className="stat-value">{summary.averageWinRate}%</span>
            </div>
          </div>

          {/* Most Queried Endgame */}
          {summary.mostQueried && (
            <div className="most-queried">
              <h3>Most Queried Endgame</h3>
              <div className="endgame-card">
                <div className="endgame-fen">{summary.mostQueried.fen}</div>
                <div className="endgame-details">
                  <span className="detail">Variant: <strong>{summary.mostQueried.variant}</strong></span>
                  <span className="detail">Queries: <strong>{summary.mostQueried.queries}</strong></span>
                  <span className="detail">Win Rate: <strong>{summary.mostQueried.winsPercentage.toFixed(0)}%</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Popular Endgames */}
          {popularEndgames.length > 0 && (
            <div className="popular-endgames">
              <h3>Popular Endgames</h3>
              <div className="endgames-list">
                {popularEndgames.map((endgame, idx) => (
                  <div key={idx} className="endgame-row">
                    <span className="rank">#{idx + 1}</span>
                    <span className="fen-short">{endgame.fen.substring(0, 20)}...</span>
                    <span className="queries" title={`Queries: ${endgame.queries}`}>
                      {endgame.queries}x
                    </span>
                    <span className="variant-badge">{endgame.variant}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {summary.totalQueries === 0 && (
            <div className="empty-state">
              <p>No tablebase queries recorded yet.</p>
              <p className="hint">Play some endgame positions to start collecting statistics.</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="stats-footer">
          <button className="button-secondary" onClick={handleExportStats} disabled={summary.totalQueries === 0}>
            <Download size={16} />
            Export
          </button>
          <button className="button-danger" onClick={handleClearStats} disabled={summary.totalQueries === 0}>
            <Trash2 size={16} />
            Clear Stats
          </button>
        </div>
      </div>
    </div>
  );
};

export default TablebaseStats;
