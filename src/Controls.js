const ENGINE_PRESETS = [
  { label: 'Beginner', movetime: 500, depth: 10 },
  { label: 'Intermediate', movetime: 2000, depth: 15 },
  { label: 'Advanced', movetime: 5000, depth: 20 },
  { label: 'Master', movetime: 10000, depth: 30 },
];

import React, { useState, useEffect } from 'react';
import toast from 'react-toastify';
import {
  RotateCcw,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  Play,
  User,
  Eye,
  Cpu,
} from 'react-feather';

const Section = ({ title, icon, children }) => (
  <div className="control-section">
    <h3 className="section-title">
      <span aria-hidden="true">{icon}</span>
      <span>{title}</span>
    </h3>
    <div className="section-content">{children}</div>
  </div>
);

const IconButton = ({ onClick, icon, text, disabled = false, shortcut }) => (
  <button
    onClick={onClick}
    className="icon-button"
    disabled={disabled}
    title={shortcut ? `${text} (${shortcut})` : text}
    aria-label={shortcut ? `${text} (${shortcut})` : text}
  >
    {icon}
    <span>{text}</span>
    {shortcut && <kbd className="shortcut-hint">{shortcut}</kbd>}
  </button>
);

const Toggle = ({ label, checked, onChange }) => (
  <div className="toggle-switch">
    <label>
      {label}
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="slider" aria-hidden="true"></span>
    </label>
  </div>
);

const Controls = ({
  onReset, onFlip, onUndo, onRedo, canUndo, canRedo,
  engineSettings, setEngineSettings, sendCommand,
  onFenClick, onPgnClick,
  isAutoMoveEnabled, setIsAutoMoveEnabled,
  userColor, setUserColor,
  backendUrl,
  engineMode,
  isOnlineMode = false,
  multiPv = 1,
  onMultiPvChange,
  showArrow = true,
  onShowArrowChange,
}) => {
  const [engines, setEngines] = useState([]);
  const [selectedEngine, setSelectedEngine] = useState('');

  useEffect(() => {
    if (engineMode === 'backend') {
      fetch(`${backendUrl}/api/engines`)
        .then((res) => res.json())
        .then((data) => {
          setEngines(data);
          if (data.length > 0) setSelectedEngine(data[0]);
        })
        .catch((err) => console.error('Error fetching engines:', err));
    } else {
      // Browser mode: single WASM engine, no selection needed
      setEngines(['Stockfish 18 (WASM)']);
      setSelectedEngine('Stockfish 18 (WASM)');
    }
  }, [backendUrl, engineMode]);

  const handleEngineChange = (e) => {
    const engineName = e.target.value;
    setSelectedEngine(engineName);
    if (engineMode === 'backend') {
      fetch(`${backendUrl}/api/select-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: engineName }),
      })
        .then((res) => res.json())
        .then((data) => console.log(data.message))
        .catch((err) => console.error('Error selecting engine:', err));
    }
  };

  const handleThreadsChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setEngineSettings.setThreads(value);
    sendCommand(`setoption name Threads value ${value}`);
  };

  const handleHashChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setEngineSettings.setHashSize(value);
    sendCommand(`setoption name Hash value ${value}`);
  };

  const handlePresetChange = (e) => {
    const value = e.target.value;
    if (!value) return;
    const preset = ENGINE_PRESETS.find((p) => p.label === value);
    if (!preset) return;
    setEngineSettings.setMovetime(preset.movetime);
    setEngineSettings.setDepth(preset.depth);
    sendCommand(`go movetime ${preset.movetime}`);
    toast(`Preset: ${preset.label} (${preset.movetime}ms, depth ${preset.depth})`);
  };

  return (
    <div className="panel controls">
      <Section title="Game" icon={<Play size={20} />}>
        <div className="button-grid">
          <IconButton onClick={onReset} icon={<RotateCcw size={18} />} text="New" shortcut="R" />
          <IconButton onClick={onFlip} icon={<Repeat size={18} />} text="Flip" shortcut="F" />
          <IconButton onClick={onUndo} icon={<ChevronLeft size={18} />} text="Undo" disabled={!canUndo} shortcut="←" />
          <IconButton onClick={onRedo} icon={<ChevronRight size={18} />} text="Redo" disabled={!canRedo} shortcut="→" />
        </div>
      </Section>

      <Section title="Position" icon={<Upload size={20} />}>
        <div className="button-grid">
          <IconButton onClick={onFenClick} icon={<Download size={18} />} text="FEN" />
          <IconButton onClick={onPgnClick} icon={<Download size={18} />} text="PGN" />
        </div>
      </Section>

      <Section title="Player" icon={<User size={20} />}>
        <div className="control-group">
          <label htmlFor="userColor">Play as</label>
          <select id="userColor" value={userColor} onChange={(e) => setUserColor(e.target.value)} disabled={isOnlineMode}>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </div>
        <Toggle
          label="Auto-move Opponent"
          checked={isAutoMoveEnabled}
          onChange={(e) => setIsAutoMoveEnabled(e.target.checked)}
        />
      </Section>

      <Section title="Display" icon={<Eye size={20} />}>
        <Toggle
          label="Last-move arrow"
          checked={showArrow}
          onChange={(e) => onShowArrowChange(e.target.checked)}
        />
      </Section>

      <Section title="Engine" icon={<Cpu size={20} />}>
        <div className="control-group">
          <label htmlFor="engine-select">Chess Engine</label>
          <select id="engine-select" value={selectedEngine} onChange={handleEngineChange}>
            {engines.map((engine) => (
              <option key={engine} value={engine}>{engine}</option>
            ))}
          </select>
        </div>

        {!engineSettings.isDepthAnalysisEnabled && (
          <div className="control-group">
            <label htmlFor="movetime">Analysis Time (ms)</label>
            <select id="movetime" value={engineSettings.movetime} onChange={(e) => setEngineSettings.setMovetime(parseInt(e.target.value, 10))}>
              {[1000, 2000, 3000, 5000, 10000].map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </div>
        )}

        <div className="control-group">
          <label htmlFor="depth">Search Depth</label>
          <select id="depth" value={engineSettings.depth} onChange={(e) => setEngineSettings.setDepth(parseInt(e.target.value, 10))}>
            {[10, 15, 20, 25, 30].map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {engineMode === 'backend' ? (
          <div className="control-group" title="CPU threads for engine analysis">
            <label htmlFor="threads">CPU Threads: {engineSettings.threads}</label>
            <input type="range" id="threads" min="1" max={engineSettings.maxThreads} value={engineSettings.threads} onChange={handleThreadsChange} />
          </div>
        ) : (
          <div className="control-group">
            <label htmlFor="threads-single">Threads: 1 (single-thread WASM)</label>
            <input type="range" id="threads-single" min="1" max="1" value="1" disabled style={{ opacity: 0.4 }} />
          </div>
        )}

        <div className="control-group">
          <label htmlFor="hash">Hash Size (MB)</label>
          <select id="hash" value={engineSettings.hashSize} onChange={handleHashChange}>
            {(() => {
              // Clamp hash options to 128MB max in browser WASM mode to avoid crashes on low-end devices
              const maxHash = engineMode === 'backend'
                ? Math.min(engineSettings.maxHashSize, 1024)
                : Math.min(engineSettings.maxHashSize, 128);
              return [16, 32, 64, 128, 256, 512, 1024]
                .filter((size) => size <= maxHash)
                .map((size) => (
                  <option key={size} value={size}>{size}</option>
                ));
            })()}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="preset-select">Strength Preset</label>
          <select id="preset-select" onChange={handlePresetChange} defaultValue="">
            <option value="" disabled>Select preset...</option>
            {ENGINE_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="multiPv">Analysis Lines</label>
          <select id="multiPv" value={multiPv} onChange={(e) => onMultiPvChange(parseInt(e.target.value, 10))}>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </Section>
    </div>
  );
};

export default Controls;
