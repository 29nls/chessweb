import React, { useState, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import { ChevronRight, RotateCcw, Shuffle, Star, Filter } from 'react-feather';
import ChessboardContainer from '../ChessboardContainer';
import { getRandomPuzzle } from '../data/puzzles';
import { playMoveSound } from '../lib/sound';
import './PuzzlePage.css';

/** Difficulty rating thresholds */
const DIFFICULTIES = [
  { key: 'all', label: 'All', minRating: 0, maxRating: 9999 },
  { key: 'easy', label: 'Easy', minRating: 0, maxRating: 1300 },
  { key: 'medium', label: 'Medium', minRating: 1301, maxRating: 1700 },
  { key: 'hard', label: 'Hard', minRating: 1701, maxRating: 9999 },
];

/**
 * PuzzlePage - Chess tactics trainer.
 * Loads FEN puzzles, validates moves against the solution line.
 */
export default function PuzzlePage() {
  // Puzzle state
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState('start');
  const [solutionIndex, setSolutionIndex] = useState(0); // how many solution moves applied
  const [puzzleStarted, setPuzzleStarted] = useState(false);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [lastMove, setLastMove] = useState(null);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[0]); // default 'all'
  const [wrongMove, setWrongMove] = useState(null);

  const gameRef = useRef(game);
  const fenRef = useRef(fen);

  const updateGame = useCallback((newGame) => {
    gameRef.current = newGame;
    setGame(newGame);
    const newFen = newGame.fen();
    fenRef.current = newFen;
    setFen(newFen);
  }, []);

  /**
   * Load a specific puzzle on the board.
   */
  const loadPuzzle = useCallback((puzzle) => {
    setCurrentPuzzle(puzzle);
    setSolutionIndex(0);
    setPuzzleSolved(false);
    setPuzzleStarted(false);
    setShowHint(false);
    setHintsUsed(0);
    setLastMove(null);
    setWrongMove(null);

    const newGame = new Chess(puzzle.fen);
    updateGame(newGame);
    return newGame;
  }, [updateGame]);

  /**
   * Load a random puzzle to start.
   */
  const loadRandomPuzzle = useCallback(() => {
    const filters = difficulty.key === 'all'
      ? { minRating: difficulty.minRating, maxRating: difficulty.maxRating }
      : { minRating: difficulty.minRating, maxRating: difficulty.maxRating };
    const puzzle = getRandomPuzzle(filters);
    loadPuzzle(puzzle);
  }, [loadPuzzle, difficulty]);

  /**
   * Start the puzzle (dismisses the start screen).
   */
  const startPuzzle = useCallback(() => {
    if (!currentPuzzle) {
      loadRandomPuzzle();
    }
    setPuzzleStarted(true);
  }, [currentPuzzle, loadRandomPuzzle]);

  /**
   * Apply opponent's response from the solution.
   */
  const applyOpponentResponse = useCallback((g, puzzle, index) => {
    if (index >= puzzle.moves.length) {
      // no more opponent moves - puzzle complete
      setPuzzleSolved(true);
      setSolutionIndex(index);
      return;
    }

    const opponentSan = puzzle.moves[index];
    try {
      const result = g.move(opponentSan, { sloppy: true });
      if (result) {
        updateGame(g);
        setLastMove({ from: result.from, to: result.to });
        setSolutionIndex(index + 1);
        playMoveSound(result, g);
      }
    } catch (e) {
      // Shouldn't happen - puzzle data is correct
      setPuzzleSolved(true);
    }
  }, [updateGame]);

  /**
   * Handle a player's move on the board.
   */
  const handleMove = useCallback((from, to, promotion = 'q') => {
    if (!currentPuzzle || puzzleSolved) return false;

    const g = gameRef.current;
    const moveResult = g.move({ from, to, promotion });

    if (moveResult === null) {
      toast.info('Illegal move');
      return false;
    }

    playMoveSound(moveResult, g);

    const playerSan = moveResult.san;
    const expectedPlayerSan = currentPuzzle.moves[solutionIndex];

    if (playerSan === expectedPlayerSan) {
      // Correct! Update board, apply opponent's response
      updateGame(g);
      setLastMove({ from: moveResult.from, to: moveResult.to });

      const newIndex = solutionIndex + 1;
      if (newIndex >= currentPuzzle.moves.length) {
        // Puzzle solved! (last move was the final player move)
        setPuzzleSolved(true);
        setSolutionIndex(newIndex);
        setScore((prev) => prev + Math.max(10 - hintsUsed, 1) * Math.ceil(currentPuzzle.rating / 500));
        setStreak((prev) => prev + 1);
        toast.success('Puzzle solved!', { autoClose: 2000 });
      } else {
        // Apply opponent's response
        // Use setTimeout so React updates before the opponent's move
        setTimeout(() => {
          applyOpponentResponse(g, currentPuzzle, newIndex);
        }, 400);
      }
    } else {
      // Wrong move
      setAttempts((prev) => prev + 1);
      setStreak(0);
      setWrongMove({ from, to });
      toast.info('Incorrect - try again!');

      // Undo player's move
      g.undo();
      updateGame(g);
    }

    return true;
  }, [currentPuzzle, puzzleSolved, solutionIndex, updateGame, applyOpponentResponse, hintsUsed]);

  const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
    if (!puzzleStarted) {
      toast.info('Press "Start Puzzle" to begin!');
      return false;
    }

    // Check pawn promotion
    const g = gameRef.current;
    const piece = g.get(sourceSquare);
    if (piece && piece.type === 'p' &&
        ((piece.color === 'w' && targetSquare[1] === '8') ||
         (piece.color === 'b' && targetSquare[1] === '1'))) {
      // Default to queen for simplicity in puzzles
      return handleMove(sourceSquare, targetSquare, 'q');
    }

    return handleMove(sourceSquare, targetSquare);
  }, [puzzleStarted, handleMove]);

  /**
   * Show a hint (highlights the correct move's source square).
   */
  const handleHint = useCallback(() => {
    if (!currentPuzzle || puzzleSolved) return;
    setShowHint(true);
    setHintsUsed((prev) => prev + 1);
  }, [currentPuzzle, puzzleSolved]);

  /**
   * Reset the current puzzle to the starting position.
   */
  const handleReset = useCallback(() => {
    if (currentPuzzle) {
      loadPuzzle(currentPuzzle);
      setPuzzleStarted(true);
      toast.info('Puzzle reset');
    }
  }, [currentPuzzle, loadPuzzle]);

  /**
   * Skip to the next puzzle.
   */
  const handleNextPuzzle = useCallback(() => {
    const filters = difficulty.key === 'all'
      ? { minRating: difficulty.minRating, maxRating: difficulty.maxRating }
      : { minRating: difficulty.minRating, maxRating: difficulty.maxRating };
    const puzzle = getRandomPuzzle(filters);
    loadPuzzle(puzzle);
    setPuzzleStarted(true);
  }, [loadPuzzle, difficulty]);

  /**
   * Change difficulty filter and load a new puzzle.
   */
  const handleDifficultyChange = useCallback((diff) => {
    setDifficulty(diff);
    const filters = diff.key === 'all'
      ? { minRating: diff.minRating, maxRating: diff.maxRating }
      : { minRating: diff.minRating, maxRating: diff.maxRating };
    const puzzle = getRandomPuzzle(filters);
    loadPuzzle(puzzle);
    setPuzzleStarted(true);
  }, [loadPuzzle]);

  // Compute hint square: highlight the piece to move
  const hintSquare = showHint && currentPuzzle && solutionIndex < currentPuzzle.moves.length
    ? (() => {
        try {
          const g = new Chess(fen);
          const moves = g.moves({ verbose: true });
          const expected = currentPuzzle.moves[solutionIndex];
          const move = moves.find((m) => m.san === expected);
          return move ? move.from : null;
        } catch (e) {
          return null;
        }
      })()
    : null;

  // Custom square styles passed to ChessboardContainer for hints
  const customSquareStyles = {};
  if (hintSquare) {
    customSquareStyles[hintSquare] = {
      background: 'radial-gradient(circle, rgba(255, 215, 0, 0.60), rgba(255, 215, 0, 0.260), transparent 100%)',
    };
  }
  if (wrongMove) {
    customSquareStyles[wrongMove.from] = {
      background: 'radial-gradient(circle, rgba(255, 80, 80, 0.60), rgba(255, 80, 80, 0.260), transparent 100%)',
    };
    customSquareStyles[wrongMove.to] = {
      background: 'radial-gradient(circle, rgba(255, 80, 80, 0.60), rgba(255, 80, 80, 0.260), transparent 100%)',
    };
  }

  // Check if board is interactive (puzzle started, not solved)
  const isBoardInteractive = puzzleStarted && !puzzleSolved;

  // Determine board orientation from the FEN (side to move)
  const fenSide = currentPuzzle ? currentPuzzle.fen.split(' ')[1] : 'w';
  const boardOrientation = fenSide === 'w' ? 'white' : 'black';
  const userColor = boardOrientation;

  return (
    <div className="App">
      <main className="App-body puzzle-mode">
        {/* Left panel: Puzzle Info */}
        <div className="puzzle-info-panel">
          {currentPuzzle ? (
            <>
              <div className="puzzle-header">
                <h2 className="puzzle-title">Tactics Trainer</h2>
                <div className="puzzle-meta">
                  <span className="puzzle-rating" title="Difficulty">
                    <Star size={14} /> {currentPuzzle.rating}
                  </span>
                  <span className="puzzle-id">#{currentPuzzle.id}</span>
                </div>
              </div>

              {/* Active difficulty filter bar */}
              <div className="difficulty-filter-bar">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.key}
                    className={`diff-btn ${difficulty.key === d.key ? 'active' : ''}`}
                    onClick={() => handleDifficultyChange(d)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="puzzle-themes">
                {currentPuzzle.themes.map((theme) => (
                  <span key={theme} className="puzzle-theme-tag">{theme}</span>
                ))}
              </div>

              <p className="puzzle-description">{currentPuzzle.description}</p>

              <div className="puzzle-stats">
                <div className="puzzle-stat">
                  <span className="stat-value">{score}</span>
                  <span className="stat-label">Score</span>
                </div>
                <div className="puzzle-stat">
                  <span className="stat-value">{streak}</span>
                  <span className="stat-label">Streak</span>
                </div>
                <div className="puzzle-stat">
                  <span className="stat-value">{attempts}</span>
                  <span className="stat-label">Attempts</span>
                </div>
              </div>

              <div className="puzzle-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${(solutionIndex / currentPuzzle.moves.length) * 100}%` }}
                  />
                </div>
                <span className="progress-text">{solutionIndex}/{currentPuzzle.moves.length}</span>
              </div>

              {puzzleSolved && (
                <div className="puzzle-solved-banner">
                  <span className="solved-icon">🎉</span>
                  <span className="solved-text">Solved!</span>
                </div>
              )}

              <div className="puzzle-actions">
                {!puzzleStarted && (
                  <button className="puzzle-btn-start" onClick={startPuzzle}>
                    Start Puzzle
                  </button>
                )}

                <button
                  className="puzzle-btn"
                  onClick={handleHint}
                  disabled={puzzleSolved || showHint}
                  title="Show hint"
                >
                  <Star size={16} /> Hint
                </button>
                <button
                  className="puzzle-btn"
                  onClick={handleReset}
                  title="Reset position"
                >
                  <RotateCcw size={16} /> Reset
                </button>
                <button
                  className="puzzle-btn puzzle-btn-primary"
                  onClick={handleNextPuzzle}
                  title="Next puzzle"
                >
                  <Shuffle size={16} /> Next
                </button>
              </div>
            </>
          ) : (
            <div className="puzzle-start-screen">
              <div className="puzzle-start-icon">🧩</div>
              <h2>Tactics Trainer</h2>
              <p>Sharpen your tactical skills with curated chess puzzles.</p>

              <div className="difficulty-selector">
                <span className="difficulty-label">
                  <Filter size={13} /> Difficulty
                </span>
                <div className="difficulty-buttons">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.key}
                      className={`diff-btn ${difficulty.key === d.key ? 'active' : ''}`}
                      onClick={() => setDifficulty(d)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className="puzzle-btn-start" onClick={startPuzzle}>
                <Shuffle size={18} /> Start Training
              </button>
            </div>
          )}
        </div>

        {/* Center: Chessboard */}
        <div style={{ gridArea: 'chessboard' }}>
          <div className="puzzle-board-wrapper">
            <ChessboardContainer
              fen={fen}
              onDrop={onDrop}
              boardOrientation={boardOrientation}
              lastMove={lastMove}
              isAutoMoveEnabled={false}
              makeAutoOpponentMove={() => {}}
              userColor={userColor}
              isOnlineMode={false}
              isSpectator={!isBoardInteractive}
              showArrow={true}
              customSquareStyles={customSquareStyles}
            />
          </div>
        </div>

        {/* Right panel: Move History / Solution */}
        <div className="puzzle-moves-panel">
          {currentPuzzle ? (
            <>
              <h3 className="panel-title">Solution</h3>
              <div className="puzzle-solution-list">
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

              <button
                className="puzzle-nav-btn"
                onClick={handleNextPuzzle}
              >
                Next Puzzle <ChevronRight size={16} />
              </button>
            </>
          ) : (
            <div className="puzzle-start-info">
              <p>Press "Start Training" to begin solving puzzles.</p>
              <p className="puzzle-start-sub">
                Each puzzle requires you to find the best moves. <br />
                Make a move, the engine (opponent) will respond.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
