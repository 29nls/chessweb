import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  Eye,
  Zap,
  Clock,
  ChevronRight,
  Cpu,
  Target,
} from 'react-feather';
import puzzles from './data/puzzles';
import './LandingScreen.css';

// ── Mockup visuals ──
// These show the screen each mode leads to. They live inside the mode cards
// rather than in a separate section, because a second section describing the
// same six modes added scroll length without adding information.

const EvalBarMockup = () => (
  <div className="mockup-eval-bar">
    <div className="mockup-bar-track">
      <div className="mockup-bar-fill-white" style={{ width: '62%' }}>
        <span className="mockup-bar-text">+1.42</span>
      </div>
      <div className="mockup-bar-divider" />
      <div className="mockup-bar-fill-black" style={{ width: '38%' }} />
    </div>
    <div className="mockup-pv-line">
      <span className="mockup-pv-number">1.</span>
      <span className="mockup-pv-move">e4</span>
      <span className="mockup-pv-number">2.</span>
      <span className="mockup-pv-move mockup-pv-move-second">e5</span>
      <span className="mockup-pv-number">3.</span>
      <span className="mockup-pv-move">Nf3</span>
    </div>
  </div>
);

const ChessboardMockup = () => {
  const squares = [
    ['♜', '', '♝', ''],
    ['', '♟', '', '♟'],
    ['♙', '', '♞', ''],
    ['', '♝', '', '♚'],
  ];

  return (
    <div className="mockup-board">
      {squares.map((row, ri) =>
        row.map((piece, ci) => {
          const isLight = (ri + ci) % 2 === 0;
          return (
            <div
              key={`${ri}-${ci}`}
              className={`mockup-square ${isLight ? 'light' : 'dark'}`}
            >
              {piece && <span className="mockup-piece">{piece}</span>}
            </div>
          );
        })
      )}
    </div>
  );
};

const OnlineMockup = () => (
  <div className="mockup-online">
    <div className="mockup-connection-row">
      <div className="mockup-player-dot mockup-dot-active" />
      <div className="mockup-player-info">
        <span className="mockup-player-name">You</span>
      </div>
      <div className="mockup-vs">vs</div>
      <div className="mockup-player-info">
        <span className="mockup-player-name">Opponent</span>
      </div>
      <div className="mockup-player-dot mockup-dot-pulse" />
    </div>
    <div className="mockup-status-bar">
      <div className="mockup-status-dot" />
      <span>Connected</span>
      <span className="mockup-clock">15:00</span>
    </div>
  </div>
);

// ── Mode card ──
const LandingCard = ({ title, description, icon, visual, variantClass = '', onClick, keyboardHint }) => (
  <button className={`landing-card ${variantClass}`} onClick={onClick}>
    <div className="card-icon" aria-hidden="true">
      {icon}
    </div>
    <div className="card-body">
      <h2>
        {title}
        {keyboardHint && (
          <kbd className="card-key-hint" aria-label={`Keyboard shortcut ${keyboardHint}`}>
            {keyboardHint}
          </kbd>
        )}
      </h2>
      <p>{description}</p>
    </div>
    {visual && (
      <div className="card-visual" aria-hidden="true">
        {visual}
      </div>
    )}
    <div className="card-arrow" aria-hidden="true">
      <ChevronRight size={18} />
    </div>
  </button>
);

// ── Landing screen ──
const LandingScreen = () => {
  const navigate = useNavigate();

  // Keyboard shortcuts: 1-5 jump straight to a mode.
  const handleKeyDown = useCallback(
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const keyMap = {
        '1': '/analysis',
        '2': '/online?tab=play',
        '3': '/online?tab=spectate',
        '4': '/puzzles',
        '5': '/history',
      };
      const path = keyMap[e.key];
      if (path) {
        e.preventDefault();
        navigate(path);
      }
    },
    [navigate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <main className="landing-screen">
      <header className="landing-header">
        {/* The brand mark is a knight, not a CPU chip: the product is a study
            room, and hardware is not what it is about. */}
        <div className="logo-mark" aria-hidden="true">
          <span className="logo-piece">♞</span>
        </div>
        <h1>ChessWeb</h1>
        <p className="tagline">
          Play, analyze, and review chess in the browser.
          Stockfish 18 runs locally, so no analysis leaves your machine.
        </p>
      </header>

      <section className="landing-cards" aria-label="Game modes">
        <LandingCard
          title="Analysis Mode"
          description={`Play both sides locally. Stockfish 18 evaluates every move at depth 20 by default, with multi-variation lines you can click through.`}
          icon={<Cpu size={22} />}
          visual={<EvalBarMockup />}
          keyboardHint="1"
          onClick={() => navigate('/analysis')}
        />

        <LandingCard
          title="Play Online"
          description="Challenge a friend to a real-time match. Create a game and share the 6-character code."
          icon={<Globe size={22} />}
          variantClass="online"
          visual={<OnlineMockup />}
          keyboardHint="2"
          onClick={() => navigate('/online?tab=play')}
        />

        <LandingCard
          title="Watch Live"
          description="Spectate ongoing matches without disturbing the players. No account needed."
          icon={<Eye size={22} />}
          variantClass="spectator"
          keyboardHint="3"
          onClick={() => navigate('/online?tab=spectate')}
        />

        <LandingCard
          title="Tactics Trainer"
          description={`${puzzles.length} curated puzzles covering forks, pins, sacrifices and endgame technique, with instant feedback on every move.`}
          icon={<Target size={22} />}
          variantClass="puzzle"
          visual={<ChessboardMockup />}
          keyboardHint="4"
          onClick={() => navigate('/puzzles')}
        />

        <LandingCard
          title="Puzzle Rush"
          description="Solve as many puzzles as you can before the clock runs out. Three lives, one score."
          icon={<Zap size={22} />}
          variantClass="puzzle-rush"
          onClick={() => navigate('/puzzle-rush')}
        />

        <LandingCard
          title="Game History"
          description="Review completed games. Replay them with Stockfish evaluation and step through every variation."
          icon={<Clock size={22} />}
          variantClass="history"
          keyboardHint="5"
          onClick={() => navigate('/history')}
        />
      </section>

      <footer className="landing-footer">
        <span className="powered-by">
          <Cpu size={14} /> Stockfish 18, self-hosted
        </span>
        <div className="footer-links">
          <span>Press keys 1 to 5 to navigate</span>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/29nls/chessweb" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
};

export default LandingScreen;
