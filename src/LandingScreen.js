import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu,
  Globe,
  Eye,
  Zap,
  Clock,
  ChevronRight,
  Sun,
  Moon,
  BarChart2,
  Users,
  Award,
} from 'react-feather';
import { useLoadingSequence } from './hooks/useLoadingSequence';
import './LandingScreen.css';

// ── Floating chess pieces (Unicode) ──
const FLOATING_PIECES = ['♛', '♞', '♝', '♜', '♟', '♚'];

// ── Chess Piece Carousel (reuse same pattern as SkeletonLoader) ──
const LANDING_PIECES = ['♔', '♕', '♖', '♗', '♘', '♙'];
const LANDING_STEP_PIECES = ['♙', '♘', '♗', '♖', '♕'];

const LandingPieceLogo = ({ activeIndex = 0 }) => {
  const [pieceIndex, setPieceIndex] = useState(0);
  const [isEntering, setIsEntering] = useState(false);

  useEffect(() => {
    // Trigger entrance when step changes
    setIsEntering(true);
    const t = setTimeout(() => setIsEntering(false), 600);
    return () => clearTimeout(t);
  }, [activeIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPieceIndex((p) => (p + 1) % LANDING_PIECES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Cycle pieces independently but also jump when step changes
  const displayPiece = LANDING_PIECES[pieceIndex];
  const typeClass = (() => {
    switch (displayPiece) {
      case '♔': return 'cp-king';
      case '♕': return 'cp-queen';
      case '♖': return 'cp-rook';
      case '♗': return 'cp-bishop';
      case '♘': return 'cp-knight';
      default: return 'cp-pawn';
    }
  })();

  return (
    <div className="sk-cp-carousel" aria-hidden="true">
      <div className={`sk-cp-icon ${typeClass} ${isEntering ? 'cp-entering' : 'cp-idle'}`}>
        <span className="sk-cp-piece" key={displayPiece}>{displayPiece}</span>
        <div className="sk-cp-glow" />
      </div>
    </div>
  );
};

// ── Shimmer Skeleton Element ──
const ShimmerBlock = ({ width, height, borderRadius = '0.75rem', className = '' }) => (
  <div
    className={`landing-sk-block ${className}`}
    style={{ width, height, borderRadius }}
    aria-hidden="true"
  />
);

// ── Progress bar step config ──
const LOADING_STEPS = [
  { label: 'Menyiapkan antarmuka…', pct: 18, section: 'header' },
  { label: 'Memuat mode permainan…', pct: 38, section: 'cards' },
  { label: 'Mengumpulkan statistik…', pct: 56, section: 'stats' },
  { label: 'Menyusun fitur unggulan…', pct: 76, section: 'features' },
  { label: 'Finalisasi…', pct: 92, section: 'footer' },
];

// ── Landing Skeleton ──
const LandingSkeleton = ({ stepIndex }) => {
  const current = LOADING_STEPS[Math.min(stepIndex, LOADING_STEPS.length - 1)];
  const progressPct = current?.pct ?? 0;
  const activeSection = current?.section ?? '';

  const skCls = (section) =>
    `landing-sk-section ${activeSection === section ? 'sk-section-active' : ''}`;  return (
    <div className="landing-skeleton" aria-label="Loading content" aria-busy="true">
      {/* ── Progress bar with chess piece logo ── */}
      <div className="landing-sk-progress-row">
        <LandingPieceLogo activeIndex={stepIndex} />
        <div className="landing-sk-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="landing-sk-progress-fill" style={{ width: `${progressPct}%` }} />
          <span className="landing-sk-progress-label">{current?.label ?? ''}</span>
        </div>
      </div>

      {/* ── Piece step indicators ── */}
      <div className="landing-sk-steps" aria-hidden="true">
        {LOADING_STEPS.map((s, i) => {
          const pieceChar = LANDING_STEP_PIECES[i % LANDING_STEP_PIECES.length];
          const isDone = i <= stepIndex;
          const isCurrent = i === stepIndex;
          return (
            <div key={s.section} className={`landing-sk-step ${isDone ? 'step-done' : ''} ${isCurrent ? 'step-current' : ''}`}>
              <div className="landing-sk-step-dot">
                {isDone ? (
                  <span className="landing-sk-step-piece">{pieceChar}</span>
                ) : (
                  <span className="landing-sk-step-empty" />
                )}
              </div>
              <span className="landing-sk-step-label">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* ── Header skeleton ── */}
      <div className={skCls('header')}>
        <div className="landing-sk-header">
          <ShimmerBlock width="64px" height="64px" borderRadius="18px" />
          <ShimmerBlock width="240px" height="36px" borderRadius="8px" className="landing-sk-title" />
          <ShimmerBlock width="340px" height="16px" borderRadius="6px" />
          <ShimmerBlock width="280px" height="16px" borderRadius="6px" />
        </div>
      </div>

      {/* ── Cards skeleton ── */}
      <div className={skCls('cards')}>
        <div className="landing-sk-cards">
          <div className="landing-sk-card landing-sk-card-hero">
            <ShimmerBlock width="56px" height="56px" borderRadius="14px" />
            <div className="landing-sk-card-body">
              <ShimmerBlock width="180px" height="20px" borderRadius="6px" />
              <ShimmerBlock width="100%" height="14px" borderRadius="5px" />
              <ShimmerBlock width="85%" height="14px" borderRadius="5px" />
            </div>
            <ShimmerBlock width="32px" height="32px" borderRadius="50%" />
          </div>

          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="landing-sk-card">
              <ShimmerBlock width="48px" height="48px" borderRadius="12px" />
              <div className="landing-sk-card-body">
                <ShimmerBlock width="140px" height="18px" borderRadius="6px" />
                <ShimmerBlock width="100%" height="12px" borderRadius="5px" />
                <ShimmerBlock width="70%" height="12px" borderRadius="5px" />
              </div>
              <ShimmerBlock width="28px" height="28px" borderRadius="50%" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats skeleton ── */}
      <div className={skCls('stats')}>
        <div className="landing-sk-stats">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="landing-sk-stat">
              <ShimmerBlock width="36px" height="36px" borderRadius="10px" />
              <ShimmerBlock width="60px" height="28px" borderRadius="6px" />
              <ShimmerBlock width="80px" height="12px" borderRadius="5px" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Features skeleton ── */}
      <div className={skCls('features')}>
        <div className="landing-sk-features-header">
          <ShimmerBlock width="200px" height="24px" borderRadius="8px" />
          <ShimmerBlock width="280px" height="14px" borderRadius="5px" />
        </div>

        <div className="landing-sk-features">
          {[1, 2, 3].map((i) => (
            <div key={i} className="landing-sk-feature">
              <ShimmerBlock width="100%" height="110px" borderRadius="0.85rem" />
              <ShimmerBlock width="32px" height="32px" borderRadius="10px" />
              <ShimmerBlock width="160px" height="18px" borderRadius="6px" />
              <ShimmerBlock width="100%" height="12px" borderRadius="5px" />
              <ShimmerBlock width="100%" height="12px" borderRadius="5px" />
              <ShimmerBlock width="60%" height="12px" borderRadius="5px" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer skeleton ── */}
      <div className={skCls('footer')}>
        <div className="landing-sk-footer">
          <ShimmerBlock width="160px" height="14px" borderRadius="6px" />
        </div>
      </div>
    </div>
  );
};

// ── Landing Card ──
const LandingCard = ({
  title,
  description,
  icon,
  variantClass = '',
  badge,
  onClick,
  keyboardHint,
}) => (
  <button className={`landing-card ${variantClass}`} onClick={onClick}>
    {badge && <span className="card-badge">{badge}</span>}
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
    <div className="card-arrow" aria-hidden="true">
      <ChevronRight size={18} />
    </div>
  </button>
);

// ── Animated Counter ──
const AnimatedCounter = ({ end, suffix = '', label, icon, delay = 0 }) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    const isNumeric = typeof end === 'number';

    if (!isNumeric) {
      setCount(end);
      return;
    }

    const duration = 1500;
    const steps = 30;
    const stepTime = duration / steps;
    let step = 0;

    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        step++;
        const progress = step / steps;
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * end);

        if (step >= steps) {
          setCount(end);
          clearInterval(interval);
        } else {
          setCount(current);
        }
      }, stepTime);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [hasStarted, end, delay]);

  return (
    <div className="stat-item" ref={ref}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">
        {hasStarted ? count : 0}{suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
};

// ── Scroll Reveal Hook ──
const useScrollReveal = (threshold = 0.15) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, isVisible]);

  return [ref, isVisible];
};

// ── Parallax Feature Card ──
const FeatureCard = ({ title, description, icon, visual, staggerIndex }) => {
  const [ref, isVisible] = useScrollReveal(0.1);
  const cardRef = useRef(null);

  // 3D tilt + glow tracking on mouse move (parallax effect)
  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;
    const pctX = (x / rect.width) * 100;
    const pctY = (y / rect.height) * 100;
    card.style.setProperty('--rx', `${rotateX}deg`);
    card.style.setProperty('--ry', `${rotateY}deg`);
    card.style.setProperty('--mx', `${pctX}%`);
    card.style.setProperty('--my', `${pctY}%`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--mx', '50%');
    card.style.setProperty('--my', '50%');
  }, []);

  const directionClass = staggerIndex === 0 ? 'from-left' : staggerIndex === 1 ? 'from-bottom' : 'from-right';

  // Merge refs so both the scroll-reveal observer and the mouse handlers work
  const setMergedRef = useCallback((node) => {
    ref.current = node;
    cardRef.current = node;
  }, [ref, cardRef]);

  return (
    <div
      ref={setMergedRef}
      className={`feature-card ${directionClass} ${isVisible ? 'revealed' : ''}`}
      style={{ '--stagger': staggerIndex }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="feature-visual">{visual}</div>
      <div className="feature-body">
        <div className="feature-icon">{icon}</div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
};

// ── Mockup Visuals ──

/* Mini evaluation bar mockup */
const EvalBarMockup = () => (
  <div className="mockup-eval-bar">
    <div className="mockup-eval-label">Evaluation</div>
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
      <span className="mockup-ellipsis">…</span>
    </div>
  </div>
);

/* Mini chessboard mockup */
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

/* Online connection mockup */
const OnlineMockup = () => (
  <div className="mockup-online">
    <div className="mockup-connection-row">
      <div className="mockup-player-dot mockup-dot-active" />
      <div className="mockup-player-info">
        <span className="mockup-player-name">You</span>
        <span className="mockup-player-rating">1500</span>
      </div>
      <div className="mockup-vs">vs</div>
      <div className="mockup-player-info">
        <span className="mockup-player-name">Opponent</span>
        <span className="mockup-player-rating">1485</span>
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

// ── Main Landing Screen ──
const LandingScreen = () => {
  const navigate = useNavigate();
  const { isLoading, showSkeleton, stepIndex } = useLoadingSequence({
    minLoadingMs: 200,
    stepCount: 5,
    stepTotalMs: 900,
  });

  // Keyboard shortcuts: 1-5 to navigate to each mode
  const handleKeyDown = useCallback(
    (e) => {
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
    <div className="sk-landing-wrap">
      {/* ── Skeleton overlay (fades out smoothly) ── */}
      {showSkeleton && (
        <main className={`landing-screen sk-landing-overlay ${!isLoading ? 'sk-exit' : ''}`}>
          <div className="bg-pattern" aria-hidden="true" />
          <LandingSkeleton stepIndex={stepIndex} />
        </main>
      )}

      {/* ── Real content (fades in while skeleton fades out) ── */}
      <main className={`landing-screen sk-landing-content ${!isLoading ? 'sk-crossfade' : ''}`}>
        {/* Background chessboard pattern */}
        <div className="bg-pattern" aria-hidden="true" />

        {/* Floating chess pieces */}
        <div className="floating-pieces" aria-hidden="true">
          {FLOATING_PIECES.map((piece, i) => (
            <span key={i} className="floating-piece" aria-hidden="true">
              {piece}
            </span>
          ))}
        </div>

        {/* ── Header ── */}
        <header className="landing-header">
          <div className="logo-mark" aria-hidden="true">
            <Cpu size={32} />
            <span className="logo-piece" aria-hidden="true">♞</span>
          </div>
          <h1>ChessWeb</h1>
          <p className="tagline">
            <strong>Play</strong>, analyze, and improve your chess game with{' '}
            <strong>Stockfish 18</strong>. Choose your mode below to get started.
          </p>
        </header>

        {/* ── Game Mode Cards ── */}
        <section className="landing-cards" aria-label="Game Modes">
          <LandingCard
            title="Analysis Mode"
            description="Play locally with Stockfish 18. Analyze positions, classify moves, and explore openings with powerful engine assistance."
            icon={<Cpu size={24} />}
            badge="Popular"
            keyboardHint="1"
            onClick={() => navigate('/analysis')}
          />

          <LandingCard
            title="Play Online"
            description="Challenge a friend to a real-time 1v1 match. Create a game and share your 6-character invite code."
            icon={<Globe size={20} />}
            variantClass="online"
            badge="1v1"
            keyboardHint="2"
            onClick={() => navigate('/online?tab=play')}
          />

          <LandingCard
            title="Watch Live"
            description="Spectate ongoing matches anonymously. Join any active game without disturbing the players."
            icon={<Eye size={20} />}
            variantClass="spectator"
            badge="Live"
            keyboardHint="3"
            onClick={() => navigate('/online?tab=spectate')}
          />

          <LandingCard
            title="Tactics Trainer"
            description="Sharpen your skills with curated puzzles. Practice forks, pins, sacrifices, and more with instant feedback."
            icon={<Zap size={20} />}
            variantClass="puzzle"
            badge="Free"
            keyboardHint="4"
            onClick={() => navigate('/puzzles')}
          />

          <LandingCard
            title="Puzzle Rush"
            description="Race against the clock! Solve as many puzzles as you can with limited time and lives. Beat your high score."
            icon={<Zap size={20} />}
            variantClass="puzzle-rush"
            badge="Timed"
            onClick={() => navigate('/puzzle-rush')}
          />

          <LandingCard
            title="Game History"
            description="Review your completed games. Replay them anytime with Stockfish evaluation and explore every variation."
            icon={<Clock size={20} />}
            variantClass="history"
            badge="Review"
            keyboardHint="5"
            onClick={() => navigate('/history')}
          />
        </section>

        {/* ── Stats Row ── */}
        <section className="landing-stats" aria-label="Platform Statistics">
          <AnimatedCounter
            end={20}
            suffix=""
            label="Curated Puzzles"
            icon={<Zap size={20} />}
            delay={0}
          />
          <AnimatedCounter
            end={18}
            suffix=""
            label="Stockfish Engine"
            icon={<Cpu size={20} />}
            delay={0.15}
          />
          <AnimatedCounter
            end={1}
            suffix="v1"
            label="Online Multiplayer"
            icon={<Globe size={20} />}
            delay={0.3}
          />
          <AnimatedCounter
            end={22}
            suffix="+"
            label="Analysis Depth"
            icon={<BarChart2 size={20} />}
            delay={0.45}
          />
        </section>

        {/* ── Feature Highlights ── */}
        <section className="landing-features" aria-label="Feature Highlights">
          <div className="features-header">
            <h2>
              <Award size={22} />
              Key Features
            </h2>
            <p>
              Everything you need to take your chess game to the next level
            </p>
          </div>

          <div className="features-grid">
            <FeatureCard
              title="Deep Engine Analysis"
              description="Powered by Stockfish 18 at depth 22+. Get real-time evaluations, best lines, and multi-variation analysis with clickable PV moves."
              icon={<Cpu size={20} />}
              visual={<EvalBarMockup />}
              staggerIndex={0}
            />

            <FeatureCard
              title="Tactics Training"
              description="Sharpen your pattern recognition with 20 curated puzzles. Train forks, pins, sacrifices, and endgame techniques with instant feedback."
              icon={<Zap size={20} />}
              visual={<ChessboardMockup />}
              staggerIndex={1}
            />

            <FeatureCard
              title="Online Matches"
              description="Challenge friends to real-time 1v1 matches with 6-character invite codes. Spectate ongoing games anonymously without disturbing players."
              icon={<Users size={20} />}
              visual={<OnlineMockup />}
              staggerIndex={2}
            />
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="landing-footer">
          <span className="powered-by">
            <Cpu size={14} /> Powered by Stockfish 18
          </span>
          <div className="footer-links">
            <span>Press keys 1–5 to navigate</span>
            <span aria-hidden="true">·</span>
            <a href="https://github.com/29nls/chessweb" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </div>
        </footer>

        {/* ── Theme toggle hint ── */}
        <div className="theme-hint" aria-hidden="true">
          <Sun size={14} />
          <span>Toggle theme in the top bar</span>
          <Moon size={14} />
        </div>
      </main>
    </div>
  );
};

export default LandingScreen;
