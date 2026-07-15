import React from 'react';
import {
  BarChart2,
  ChevronsUp,
  Hash,
  Cpu,
  Database
} from 'react-feather';
import './EvaluationSection.css';

const EvaluationSection = ({ evaluation, multiPvLines = [] }) => {
  const formatEval = (ev) => {
    if (!ev || ev.score === null) return '+0.00';
    if (ev.type === 'cp') {
      const score = (ev.score / 100).toFixed(2);
      return parseFloat(score) >= 0 ? `+${score}` : score;
    }
    const prefix = ev.score > 0 ? '+' : '-';
    return `${prefix}#${Math.abs(ev.score)}`;
  };

  const EvalItem = ({ icon, label, value }) => (
    <div className="eval-item">
      <div className="eval-icon">{icon}</div>
      <div className="eval-data">
        <span className="eval-label">{label}</span>
        <span className="eval-value">{value}</span>
      </div>
    </div>
  );

  return (
    <div className="panel evaluation-section">
      <div className="main-evaluation">
        <BarChart2 size={28} />
        <h2 data-testid="evaluation-value">{formatEval(evaluation)}</h2>
      </div>
      <div className="evaluation-details">
        <EvalItem icon={<ChevronsUp size={20} />} label="Depth" value={evaluation.depth || 'N/A'} />
        <EvalItem icon={<Hash size={20} />} label="Nodes" value={evaluation.nodes ? `${(evaluation.nodes / 1000).toFixed(1)}k` : 'N/A'} />
        <EvalItem icon={<Cpu size={20} />} label="NPS" value={evaluation.nps ? `${(evaluation.nps / 1000).toFixed(1)}k` : 'N/A'} />
        <EvalItem icon={<Database size={20} />} label="TB Hits" value={evaluation.tbhits || 'N/A'} />
      </div>

      {multiPvLines.length > 1 && (
        <div className="multi-pv-lines">
          <div className="multi-pv-header">Top Lines</div>
          {multiPvLines.slice(1).map((line, i) => line ? (
            <div key={i + 1} className="multi-pv-row">
              <span className="multi-pv-idx">{`#${i + 2}`}</span>
              <span className={`multi-pv-eval ${line.score > 0 ? 'positive' : line.score < 0 ? 'negative' : ''}`}>
                {formatEval(line)}
              </span>
              <span className="multi-pv-depth">d{line.depth || '?'}</span>
              <span className="multi-pv-pv">{line.pv?.slice(0, 4).join(' ') || ''}</span>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  );
};

export default EvaluationSection;