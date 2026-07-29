import React, { useMemo } from 'react';
import {
  BarChart2,
  ChevronsUp,
  Hash,
  Cpu,
  Database,
  ChevronRight
} from 'react-feather';
import { useEvalSwing } from './hooks/useEvalSwing';
import './EvaluationSection.css';

const EvaluationSection = ({ evaluation, multiPvLines = [], whiteHeight = 50, isDepthAnalysisEnabled, onClickPvMove, isAnalyzing = false }) => {
  const formatEval = (ev) => {
    if (!ev || ev.score === null) return '+0.00';
    if (ev.type === 'cp') {
      const score = (ev.score / 100).toFixed(2);
      return parseFloat(score) >= 0 ? `+${score}` : score;
    }
    const prefix = ev.score > 0 ? '+' : '-';
    return `${prefix}#${Math.abs(ev.score)}`;
  };

  const EvalItem = ({ icon, label, value, staggerIndex }) => (
    <div className="eval-item" style={{ '--stagger': staggerIndex }}>
      <div className="eval-icon" aria-hidden="true">{icon}</div>
      <div className="eval-data">
        <span className="eval-label" id={`eval-label-${label}`}>{label}</span>
        {/* key={value} ensures React re-mounts the span on value changes, re-triggering the value-pop animation */}
        <span key={value} className="eval-value" aria-labelledby={`eval-label-${label}`}>{value}</span>
      </div>
    </div>
  );

  const isEvaluationAvailable = evaluation && evaluation.score !== null;
  const whitePct = Math.max(2, Math.min(98, whiteHeight));
  const blackPct = 100 - whitePct;

  // Derive a score-direction class for the main eval number color transition
  const scoreClass = isEvaluationAvailable
    ? (evaluation.score > 0 ? 'score-positive' : evaluation.score < 0 ? 'score-negative' : 'score-neutral')
    : 'score-neutral';

  // ── Big-swing particle detection (reusable hook) ──
  const { swingKey } = useEvalSwing(evaluation);

  // Check if we have a principal variation (best engine line) to display
  const hasPv = evaluation?.pv?.length > 0;

  return (
    <div className="panel evaluation-section">
      {/* Particle burst effect — rendered when a big eval swing is detected */}
      {swingKey > 0 && (
        <EvalBarParticles key={swingKey} evaluation={evaluation} />
      )}

      {/* Loading indicator */}
      {isAnalyzing && (
        <div className="analyzing-indicator" role="status" aria-live="polite">
          <span className="analyzing-spinner" aria-hidden="true" />
          <span className="analyzing-text">Analysing position…</span>
        </div>
      )}

      {/* Visual Evaluation Bar */}
      <div className="eval-bar-container" role="meter" aria-valuenow={whitePct} aria-valuemin={0} aria-valuemax={100} aria-label="Position evaluation">
        <div className={`eval-bar-label eval-bar-white${isEvaluationAvailable && evaluation.score > 0 ? ' eval-leads' : ''}`} style={{ width: `${whitePct}%` }}>
          {isEvaluationAvailable && evaluation.type === 'cp' && evaluation.score > 0 && (
            <span className="eval-bar-score">+{(evaluation.score / 100).toFixed(1)}</span>
          )}
        </div>
        <div className="eval-bar-divider" />
        <div className={`eval-bar-label eval-bar-black${isEvaluationAvailable && evaluation.score < 0 ? ' eval-leads' : ''}`} style={{ width: `${blackPct}%` }}>
          {isEvaluationAvailable && evaluation.type === 'cp' && evaluation.score < 0 && (
            <span className="eval-bar-score">{(evaluation.score / 100).toFixed(1)}</span>
          )}
          {isEvaluationAvailable && evaluation.type === 'mate' && (
            <span className="eval-bar-score">{evaluation.score > 0 ? '+M' : '-M'}{Math.abs(evaluation.score)}</span>
          )}
        </div>
      </div>

      {/* Main Evaluation Number — key includes swingKey so a big score swing re-triggers the flash animation */}
      <div key={`flash-${swingKey}`} className="main-evaluation">
        <BarChart2 size={28} />
        <h2 className={`eval-number ${scoreClass}`} data-testid="evaluation-value">{formatEval(evaluation)}</h2>
      </div>

      {/* Evaluation Details Grid */}
      <div className="evaluation-details">
        <EvalItem icon={<ChevronsUp size={20} />} label="Depth" value={isEvaluationAvailable ? (evaluation.depth || 'N/A') : 'N/A'} staggerIndex={0} />
        <EvalItem icon={<Hash size={20} />} label="Nodes" value={isEvaluationAvailable ? `${((evaluation.nodes || 0) / 1000).toFixed(1)}k` : 'N/A'} staggerIndex={1} />
        <EvalItem icon={<Cpu size={20} />} label="NPS" value={isEvaluationAvailable ? `${((evaluation.nps || 0) / 1000).toFixed(1)}k` : 'N/A'} staggerIndex={2} />
        <EvalItem icon={<Database size={20} />} label="TB Hits" value={isEvaluationAvailable ? (evaluation.tbhits || 'N/A') : 'N/A'} staggerIndex={3} />
      </div>

      {/* ── Best Line (PV) Display ── */}
      {isEvaluationAvailable && hasPv && (
        <div className="pv-section">
          <div className="pv-header">
            <ChevronRight size={14} />
            <span>Best Line</span>
          </div>
          <div className="pv-line">
            {(() => {
              const pvMoves = evaluation.pv || multiPvLines[0]?.pv || [];
              const pairs = [];
              for (let i = 0; i < Math.min(pvMoves.length, 10); i += 2) {
                const num = Math.floor(i / 2) + 1;
                const w = pvMoves[i];
                const b = pvMoves[i + 1];
                pairs.push({ num, w, b, globalIdx: i });
              }
              return pairs.map(({ num, w, b, globalIdx }) => (
                <span key={num} className="pv-pair" style={{ '--stagger': globalIdx }}>
                  <span className="pv-number">{num}.</span>
                  <span
                    className="pv-move pv-move-clickable"
                    onClick={() => onClickPvMove?.(pvMoves, globalIdx)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickPvMove?.(pvMoves, globalIdx); } }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Play PV move ${w}`}
                    title="Click to play this line on the board"
                  >{w}</span>
                  {b && (
                    <span
                      className="pv-move pv-move-black pv-move-clickable"
                      onClick={() => onClickPvMove?.(pvMoves, globalIdx + 1)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickPvMove?.(pvMoves, globalIdx + 1); } }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Play PV move ${b}`}
                      title="Click to play this line on the board"
                    >{b}</span>
                  )}
                </span>
              ));
            })()}
          </div>
          <div className="pv-meta">
            Depth: {evaluation.depth || '?'} | Score: {formatEval(evaluation)}
          </div>
        </div>
      )}

      {/* ── Alternative MultiPV Lines ── */}
      {multiPvLines.length > 1 && (
        <div className="multi-pv-lines">
          <div className="multi-pv-header">Alternative Lines</div>
          {multiPvLines.slice(1).map((line, i) => line ? (
            <div key={i + 1} className="multi-pv-row">
              <span className="multi-pv-idx">{`#${i + 2}`}</span>
              <span className={`multi-pv-eval ${line.score > 0 ? 'positive' : line.score < 0 ? 'negative' : ''}`}>
                {formatEval(line)}
              </span>
              <span className="multi-pv-depth">d{line.depth || '?'}</span>
              <span
                className="multi-pv-pv multi-pv-pv-clickable"
                onClick={() => onClickPvMove?.(line.pv, Math.min(line.pv?.length || 1, 6) - 1)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickPvMove?.(line.pv, Math.min(line.pv?.length || 1, 6) - 1); } }}
                tabIndex={0}
                role="button"
                aria-label={`Play alternative line starting with ${line.pv?.[0] || ''}`}
                title="Click to play this alternative line"
              >
                {line.pv?.slice(0, 6).join(' ') || ''}
              </span>
            </div>
          ) : null)}
        </div>
      )}

      {/* Analysis Settings Indicator */}
      {isDepthAnalysisEnabled && (
        <div className="analysis-mode-badge">
          Depth analysis mode
        </div>
      )}
    </div>
  );
};

/**
 * Particle burst effect that fires when a big evaluation swing is detected.
 * Renders 10 small circles that burst outward from the center of the eval bar.
 */
function EvalBarParticles({ evaluation }) {
  const particles = useMemo(() => {
    const count = 10;
    const result = [];
    const pos = evaluation.score > 0;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 360 + (Math.random() - 0.5) * 30;
      const distance = 25 + Math.random() * 50;
      const rad = (angle * Math.PI) / 180;
      result.push({
        id: i,
        dx: Math.cos(rad) * distance,
        dy: Math.sin(rad) * distance,
        size: 2 + Math.random() * 4,
        color: pos ? '#2ecc71' : '#e74c3c',
        delay: Math.random() * 0.08,
      });
    }
    return result;
  }, [evaluation.score]);

  return (
    <div className="eval-particles-container" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="eval-particle"
          style={{
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--size': `${p.size}px`,
            '--color': p.color,
            '--delay': `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default EvaluationSection;