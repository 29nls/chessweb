import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import { Zap, Heart, Clock, RotateCcw, Award } from 'react-feather';
import { useLoadingSequence } from '../hooks/useLoadingSequence';
import { PuzzleSkeleton } from '../components/SkeletonLoader';
import ErrorBoundary from '../ErrorBoundary';
import ChessboardContainer from '../ChessboardContainer';
import { getRandomPuzzle } from '../data/puzzles';
import { playMoveSound } from '../lib/sound';
import './PuzzleRushPage.css';

const TIME_PRESETS = [
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

const INITIAL_LIVES = 3;

// ── High score persistence ──
function getHighScore() {
  try {
    return parseInt(localStorage.getItem('chessweb_rush_highscore') || '0', 10);
  } catch {
    return 0;
  }
}

function saveHighScore(score) {
  try {
    const prev = getHighScore();
    if (score > prev) {
      localStorage.setItem('chessweb_rush_highscore', String(score));
    }
  } catch { /* noop */ }
}

/**
 * PuzzleRushPage — Timed puzzle streak mode.
 * Reuses the 20 existing puzzles with race-against-the-clock mechanics.
 */
export default function PuzzleRushPage() {
  const { isLoading, showSkeleton, stepIndex } = useLoadingSequence({
    minLoadingMs: 200,
    stepCount: 4,
    stepTotalMs: 700,
  });

  // ── Game configuration ──
  const [timePreset, setTimePreset] = useState(TIME_PRESETS[1]); // default 30s

  // ── Game state ──
  const [phase, setPhase] = useState('idle'); // 'idle' | 'countdown' | 'playing' | 'finished'
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [lastMove, setLastMove] = useState(null);

  // ── Puzzle tracking ──
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [puzzleIndex, setPuzzleIndex] = useState(0); // which puzzle # (0-19)
  const [puzzlesSolved, setPuzzlesSolved] = useState(0);

  // ── Rush mechanics ──
  const [timeLeft, setTimeLeft] = useState(30);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [combo, setCombo] = useState(1);
  const [highScore, setHighScore] = useState(getHighScore);
  const [scorePopup, setScorePopup] = useState(null); // { text, key }

  // ── Countdown before first puzzle ──
  const [countdownValue, setCountdownValue] = useState(3);

  // ── Wrong move feedback ──
  const [wrongMove, setWrongMove] = useState(null);
  const [shakeBoard, setShakeBoard] = useState(false);

  // ── Refs for timer and game state ──
  const timerRef = useRef(null);
  const timeLeftRef = useRef(timeLeft);
  const gameRef = useRef(game);
  const fenRef = useRef(fen);
  const currentPuzzleRef = useRef(currentPuzzle);
  const pendingTimeoutRef = useRef(null);
  const isWaitingForOpponentRef = useRef(false);
  const phaseRef = useRef(phase);
  const livesRef = useRef(lives);
  const streakRef = useRef(streak);
  const puzzleIndexRef = useRef(puzzleIndex);
  const solutionIndexRef = useRef(solutionIndex);

  // Sync refs
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { fenRef.current = fen; }, [fen]);
  useEffect(() => { currentPuzzleRef.current = currentPuzzle; }, [currentPuzzle]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { streakRef.current = streak; }, [streak]);
  useEffect(() => { puzzleIndexRef.current = puzzleIndex; }, [puzzleIndex]);
  useEffect(() => { solutionIndexRef.current = solutionIndex; }, [solutionIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    };
  }, []);

  // ── Timer ──
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const interval = setInterval(() => {
      if (phaseRef.current !== 'playing') {
        clearInterval(interval);
        timerRef.current = null;
        return;
      }
      const newTime = Math.max(0, timeLeftRef.current - 0.1);
      timeLeftRef.current = newTime;
      setTimeLeft(newTime);
      if (newTime <= 0) {
        clearInterval(interval);
        timerRef.current = null;
        handleTimeUp();
      }
    }, 100);
    timerRef.current = interval;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTimeUp = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const l = livesRef.current - 1;
    setLives(l);
    livesRef.current = l;
    setStreak(0);
    setCombo(1);
    streakRef.current = 0;
    toast.error('Time\'s up!', { autoClose: 1500 });

    if (l <= 0) {
      endGame();
    } else {
      // Skip to next puzzle (with phase guard)
      setTimeout(() => {
        if (phaseRef.current === 'playing') advancePuzzle();
      }, 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Score computation ──
  const computeScore = useCallback((rating, timeRemaining, comboMultiplier) => {
    const base = Math.floor(rating / 100);
    const timeBonus = Math.floor(timeRemaining / 3);
    const total = Math.floor((base + timeBonus) * comboMultiplier);
    return Math.max(1, total);
  }, []);

  // ── Update game state ──
  const updateGame = useCallback((newGame) => {
    gameRef.current = newGame;
    setGame(newGame);
    const newFen = newGame.fen();
    fenRef.current = newFen;
    setFen(newFen);
  }, []);

  // ── Schedule opponent response ──
  const scheduleOpponentResponse = useCallback((callback, delayMs) => {
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    isWaitingForOpponentRef.current = true;
    pendingTimeoutRef.current = setTimeout(() => {
      pendingTimeoutRef.current = null;
      isWaitingForOpponentRef.current = false;
      callback();
    }, delayMs);
  }, []);

  // ── Load a puzzle ──
  const loadPuzzle = useCallback((puzzle, pIdx) => {
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    isWaitingForOpponentRef.current = false;
    setCurrentPuzzle(puzzle);
    currentPuzzleRef.current = puzzle;
    setSolutionIndex(0);
    solutionIndexRef.current = 0;
    setLastMove(null);
    setWrongMove(null);
    setPuzzleIndex(pIdx);
    puzzleIndexRef.current = pIdx;
    const newGame = new Chess(puzzle.fen);
    updateGame(newGame);
  }, [updateGame]);

  // ── Advance to next puzzle ──
  const advancePuzzle = useCallback(() => {
    const nextIdx = puzzleIndexRef.current + 1;
    const puzzle = getRandomPuzzle();
    setPuzzlesSolved(nextIdx);
    setTimeLeft(timePreset.value);
    timeLeftRef.current = timePreset.value;
    setWrongMove(null);
    setSolutionIndex(0);
    solutionIndexRef.current = 0;
    loadPuzzle(puzzle, nextIdx);
    // Restart timer
    startTimer();
  }, [timePreset, loadPuzzle, startTimer]);

  // ── End game ──
  const endGame = useCallback(() => {
    setPhase('finished');
    stopTimer();
    if (pendingTimeoutRef.current) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
    // Use functional setter to read latest score
    setScore((s) => {
      saveHighScore(s);
      setHighScore(getHighScore());
      return s;
    });
    isWaitingForOpponentRef.current = false;
  }, [stopTimer]);

  // ── Apply opponent response ──
  const applyOpponentResponse = useCallback((g, puzzle, index) => {
    if (puzzle.id !== currentPuzzleRef.current?.id) return;
    if (index >= puzzle.moves.length) {
      // Puzzle complete!
      setLastMove(null);
      return;
    }

    const opponentSan = puzzle.moves[index];
    try {
      const result = g.move(opponentSan, { sloppy: true });
      if (result) {
        updateGame(g);
        setLastMove({ from: result.from, to: result.to });
        setSolutionIndex(index + 1);
        solutionIndexRef.current = index + 1;
        playMoveSound(result, g);
      }
    } catch {
      // Puzzle data should be correct
    }
  }, [updateGame]);

  // ── Handle player move ──
  const handleMove = useCallback((from, to, promotion = 'q') => {
    if (!currentPuzzle || phaseRef.current !== 'playing') return false;
    if (isWaitingForOpponentRef.current) {
      toast.info('Wait for opponent...');
      return false;
    }

    const g = gameRef.current;
    const moveResult = g.move({ from, to, promotion });
    if (moveResult === null) {
      toast.info('Illegal move');
      return false;
    }

    playMoveSound(moveResult, g);
    const playerSan = moveResult.san;
    const expectedPlayerSan = currentPuzzle.moves[solutionIndexRef.current];

    if (playerSan === expectedPlayerSan) {
      // ── Correct! ──
      updateGame(g);
      setLastMove({ from: moveResult.from, to: moveResult.to });
      setWrongMove(null);

      const newIdx = solutionIndexRef.current + 1;
      solutionIndexRef.current = newIdx;
      setSolutionIndex(newIdx);

      if (newIdx >= currentPuzzle.moves.length) {
        // Puzzle solved — score it
        stopTimer();
        isWaitingForOpponentRef.current = true; // block moves during transition
        const earned = computeScore(
          currentPuzzle.rating, timeLeftRef.current, combo
        );
        const newStreak = streakRef.current + 1;
        const newCombo = 1 + Math.floor(newStreak / 2) * 0.25;
        setStreak(newStreak);
        streakRef.current = newStreak;
        setCombo(newCombo);

        setScore((prev) => prev + earned);
        setScorePopup({ text: `+${earned}`, key: Date.now() });
        setPuzzlesSolved((prev) => prev + 1);

        // Check if all puzzles done
        if (puzzleIndexRef.current >= 19) {
          endGame();
          toast.success('All puzzles completed! 🏆', { autoClose: 3000 });
        } else {
          toast.success(`+${earned} pts!`, { autoClose: 1500 });
          setTimeout(() => advancePuzzle(), 600);
        }
      } else {
        // Apply opponent response
        scheduleOpponentResponse(() => {
          applyOpponentResponse(g, currentPuzzleRef.current, newIdx);
        }, 400);
      }
    } else {
      // ── Wrong move ──
      g.undo();
      updateGame(g);
      setWrongMove({ from, to });
      setShakeBoard(true);
      setTimeout(() => setShakeBoard(false), 500);
      setStreak(0);
      setCombo(1);
      streakRef.current = 0;

      const l = livesRef.current - 1;
      setLives(l);
      livesRef.current = l;

      if (l <= 0) {
        toast.error('Wrong move — game over!', { autoClose: 2000 });
        endGame();
      } else {
        toast.info(`Wrong — ${l} ${l === 1 ? 'life' : 'lives'} left`);
      }
    }

    return true;
  }, [currentPuzzle, combo, computeScore, updateGame, applyOpponentResponse,
      scheduleOpponentResponse, stopTimer, advancePuzzle, endGame]);

  const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
    if (phase !== 'playing') return false;
    const g = gameRef.current;
    const piece = g.get(sourceSquare);
    if (piece && piece.type === 'p' &&
        ((piece.color === 'w' && targetSquare[1] === '8') ||
         (piece.color === 'b' && targetSquare[1] === '1'))) {
      return handleMove(sourceSquare, targetSquare, 'q');
    }
    return handleMove(sourceSquare, targetSquare);
  }, [phase, handleMove]);

  // ── Countdown before game starts ──
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdownValue <= 0) {
      // Start game
      setPhase('playing');
      const puzzle = getRandomPuzzle();
      loadPuzzle(puzzle, 0);
      setPuzzlesSolved(0);
      setTimeLeft(timePreset.value);
      timeLeftRef.current = timePreset.value;
      startTimer();
      return;
    }
    const t = setTimeout(() => setCountdownValue((v) => v - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdownValue, timePreset, loadPuzzle, startTimer]);

  // ── Start game ──
  const startGame = useCallback(() => {
    setScore(0);
    setLives(INITIAL_LIVES);
    livesRef.current = INITIAL_LIVES;
    setStreak(0);
    streakRef.current = 0;
    setCombo(1);
    setPuzzlesSolved(0);
    setCountdownValue(3);
    setPhase('countdown');
  }, []);

  // ── Play again ──
  const playAgain = useCallback(() => {
    setHighScore(getHighScore());
    startGame();
  }, [startGame]);

  // ── Derived values ──
  const boardOrientation = currentPuzzle
    ? (currentPuzzle.fen.split(' ')[1] === 'w' ? 'white' : 'black')
    : 'white';
  const timerPct = timePreset.value > 0
    ? (timeLeft / timePreset.value) * 100
    : 100;
  const timerUrgent = timeLeft <= 5 && phase === 'playing';

  // Wrong move highlight
  const customSquareStyles = {};
  if (wrongMove) {
    customSquareStyles[wrongMove.from] = {
      background: 'radial-gradient(circle, rgba(255,80,80,0.6), rgba(255,80,80,0.26), transparent 100%)',
    };
    customSquareStyles[wrongMove.to] = {
      background: 'radial-gradient(circle, rgba(255,80,80,0.6), rgba(255,80,80,0.26), transparent 100%)',
    };
  }

  return (
    <div className="sk-transition-wrap">
      {showSkeleton && (
        <div className={`sk-fade-layer ${!isLoading ? 'sk-fade-out' : ''}`}>
          <PuzzleSkeleton stepIndex={stepIndex} />
        </div>
      )}
      <div className={`sk-entering-content ${!isLoading ? 'sk-crossfade' : ''}`}>
        <div className="App">
          <main className="App-body puzzle-rush-mode">
            {/* ── Left panel: Rush HUD ── */}
            <div className="rush-hud-panel">
              {phase === 'idle' ? (
                <RushStartScreen
                  timePreset={timePreset}
                  onTimePresetChange={setTimePreset}
                  onStart={startGame}
                  highScore={highScore}
                />
              ) : phase === 'countdown' ? (
                <div className="rush-countdown">
                  <span className="rush-countdown-num">{countdownValue}</span>
                </div>
              ) : phase === 'finished' ? (
                <RushEndScreen
                  score={score}
                  puzzlesSolved={puzzlesSolved}
                  highScore={getHighScore()}
                  lives={lives}
                  onPlayAgain={playAgain}
                />
              ) : (
                <RushHUD
                  currentPuzzle={currentPuzzle}
                  puzzleIndex={puzzleIndex}
                  puzzlesSolved={puzzlesSolved}
                  score={score}
                  lives={lives}
                  streak={streak}
                  combo={combo}
                  timerPct={timerPct}
                  timerUrgent={timerUrgent}
                  timeLeft={timeLeft}
                  scorePopup={scorePopup}
                />
              )}
            </div>

            {/* ── Center: Chessboard ── */}
            <div style={{ gridArea: 'chessboard' }}>
              <div className={`rush-board-wrapper ${shakeBoard ? 'rush-shake' : ''}`}>
                <ErrorBoundary componentName="Puzzle Rush Chessboard">
                  <ChessboardContainer
                    fen={fen}
                    onDrop={onDrop}
                    boardOrientation={boardOrientation}
                    lastMove={lastMove}
                    isAutoMoveEnabled={false}
                    makeAutoOpponentMove={() => {}}
                    userColor={boardOrientation}
                    isOnlineMode={false}
                    isSpectator={phase !== 'playing'}
                    showArrow={true}
                    customSquareStyles={customSquareStyles}
                  />
                </ErrorBoundary>
              </div>
            </div>

            {/* ── Right panel: Solution / Next moves ── */}
            <div className="rush-solution-panel">
              {currentPuzzle && phase === 'playing' ? (
                <>
                  <h3 className="panel-title">Solution</h3>
                  <div className="rush-solution-list">
                    {currentPuzzle.moves.map((move, idx) => {
                      const isPlayed = idx < solutionIndex;
                      const isNext = idx === solutionIndex;
                      const isPlayerMove = idx % 2 === 0;
                      return (
                        <div
                          key={idx}
                          className={`solution-move ${isPlayed ? 'played' : ''} ${isNext ? 'next' : ''}`}
                        >
                          <span className="move-number">
                            {isPlayerMove ? `${Math.ceil((idx + 1) / 2)}.` : ''}
                          </span>
                          <span className={`move-san ${isPlayerMove ? 'player' : 'opponent'}`}>
                            {move}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="rush-puzzle-info">
                    <span className="puzzle-rating">#{currentPuzzle.id} · {currentPuzzle.rating}</span>
                  </div>
                </>
              ) : phase === 'idle' ? (
                <div className="rush-side-start">
                  <Zap size={32} />
                  <p>Choose a time control and start the rush!</p>
                </div>
              ) : phase === 'countdown' ? (
                <div className="rush-side-start">
                  <p>Get ready...</p>
                </div>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

/** Start screen */
function RushStartScreen({ timePreset, onTimePresetChange, onStart, highScore }) {
  return (
    <div className="rush-start">
      <div className="rush-start-icon">⏱️</div>
      <h2>Puzzle Rush</h2>
      <p>Solve as many puzzles as you can before time runs out and lives hit zero.</p>

      <div className="rush-start-time">
        <span className="rush-start-time-label">Time per puzzle</span>
        <div className="rush-time-buttons">
          {TIME_PRESETS.map((tp) => (
            <button
              key={tp.value}
              className={`rush-time-btn ${timePreset.value === tp.value ? 'active' : ''}`}
              onClick={() => onTimePresetChange(tp)}
            >
              {tp.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rush-rules">
        <div className="rush-rule"><Heart size={14} /> 3 lives — lose one per mistake or timeout</div>
        <div className="rush-rule"><Zap size={14} /> Streak bonuses multiply your score</div>
        <div className="rush-rule"><Clock size={14} /> Beat the clock on all 20 puzzles</div>
      </div>

      {highScore > 0 && (
        <div className="rush-highscore">
          <Award size={16} /> Best: {highScore}
        </div>
      )}

      <button className="rush-btn-start" onClick={onStart}>
        <Zap size={18} /> Start Rush
      </button>
    </div>
  );
}

/** In-game HUD */
function RushHUD({ currentPuzzle, puzzleIndex, puzzlesSolved, score, lives, streak, combo,
                     timerPct, timerUrgent, timeLeft, scorePopup }) {
  const hearts = [];
  for (let i = 0; i < INITIAL_LIVES; i++) {
    hearts.push(
      <Heart
        key={i}
        size={16}
        className={i < lives ? 'rush-heart-full' : 'rush-heart-empty'}
        fill={i < lives ? 'currentColor' : 'none'}
      />
    );
  }

  return (
    <div className="rush-hud">
      {/* Timer bar */}
      <div className={`rush-timer-bar ${timerUrgent ? 'rush-timer-urgent' : ''}`}>
        <div className="rush-timer-fill" style={{ width: `${timerPct}%` }} />
        <span className="rush-timer-text">{timeLeft.toFixed(1)}s</span>
      </div>

      {/* Lives */}
      <div className="rush-hearts">{hearts}</div>

      {/* Score + combo */}
      <div className="rush-score-section">
        <div className="rush-main-score">{score}</div>
        <div className="rush-combo">
          {combo > 1 && <span className="rush-combo-badge">×{combo.toFixed(2)}</span>}
          {streak > 1 && <span className="rush-streak-badge">{streak} streak 🔥</span>}
          {scorePopup && (
            <span className="rush-score-popup" key={scorePopup.key}>
              {scorePopup.text}
            </span>
          )}
        </div>
      </div>

      {/* Puzzle info */}
      {currentPuzzle && (
        <div className="rush-puzzle-meta">
          <div className="rush-puzzle-themes">
            {currentPuzzle.themes.map((t) => (
              <span key={t} className="puzzle-theme-tag">{t}</span>
            ))}
          </div>
          <p className="rush-puzzle-desc">{currentPuzzle.description}</p>
          <div className="rush-puzzle-footer">
            <span className="puzzle-rating">#{currentPuzzle.id} · {currentPuzzle.rating}</span>
            <span className="rush-progress">
              Puzzle {puzzlesSolved + 1}/20
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** End screen */
function RushEndScreen({ score, puzzlesSolved, highScore, lives, onPlayAgain }) {
  const isNewHigh = score >= highScore && score > 0;
  const survived = lives > 0;

  return (
    <div className="rush-end">
      <div className="rush-end-icon">{survived ? '🏆' : '💀'}</div>
      <h2>{survived ? 'Rush Complete!' : 'Game Over'}</h2>
      {survived && <p className="rush-end-sub">You solved all 20 puzzles!</p>}

      <div className="rush-end-stats">
        <div className="rush-end-stat">
          <span className="rush-end-stat-value">{score}</span>
          <span className="rush-end-stat-label">Final Score</span>
        </div>
        <div className="rush-end-stat">
          <span className="rush-end-stat-value">{puzzlesSolved}/20</span>
          <span className="rush-end-stat-label">Solved</span>
        </div>
        {isNewHigh && (
          <div className="rush-end-stat rush-end-high">
            <Award size={18} />
            <span className="rush-end-stat-label">New High Score!</span>
          </div>
        )}
      </div>

      {!isNewHigh && highScore > 0 && (
        <p className="rush-end-best">Best: {highScore}</p>
      )}

      <div className="rush-end-actions">
        <button className="rush-btn-start" onClick={onPlayAgain}>
          <RotateCcw size={18} /> Play Again
        </button>
      </div>
    </div>
  );
}
