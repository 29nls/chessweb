import React from 'react';
import {
  BarChart2,
  ChevronsUp,
  Hash,
  Cpu,
  Database
} from 'react-feather';
import './EvaluationSection.css';

const EvaluationSection = ({ evaluation }) => {
  const getFormattedEval = () => {
    if (evaluation.score === null) return '+0.00';

    // Stockfish selalu evaluasi dari perspektif White (positif = White unggul)
    if (evaluation.type === 'cp') {
      // Centipawn ke pawn
      const score = (evaluation.score / 100).toFixed(2);
      return parseFloat(score) >= 0 ? `+${score}` : score;
    } else {
      // Mate: positif = White skakmat, negatif = Black skakmat
      const prefix = evaluation.score > 0 ? '+' : '-';
      return `${prefix}#${Math.abs(evaluation.score)}`;
    }
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
        <h2 data-testid="evaluation-value">{getFormattedEval()}</h2>
      </div>
      <div className="evaluation-details">
        <EvalItem icon={<ChevronsUp size={20} />} label="Depth" value={evaluation.depth || 'N/A'} />
        <EvalItem icon={<Hash size={20} />} label="Nodes" value={evaluation.nodes ? `${(evaluation.nodes / 1000).toFixed(1)}k` : 'N/A'} />
        <EvalItem icon={<Cpu size={20} />} label="NPS" value={evaluation.nps ? `${(evaluation.nps / 1000).toFixed(1)}k` : 'N/A'} />
        <EvalItem icon={<Database size={20} />} label="TB Hits" value={evaluation.tbhits || 'N/A'} />
      </div>
    </div>
  );
};

export default EvaluationSection;