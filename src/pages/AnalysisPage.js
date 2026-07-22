import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import { Zap } from 'react-feather';
import Modal from '../Modal';
import AccessibleDialog from '../AccessibleDialog';
import MoveHistory from '../MoveHistory';
import { useChessEngine } from '../hooks/useChessEngine';
import { useGameHistory } from '../hooks/useGameHistory';
import { useLoadingSequence } from '../hooks/useLoadingSequence';
import { AnalysisSkeleton, BoardSkeleton, PanelSkeleton, MoveHistorySkeleton } from '../components/SkeletonLoader';
import ErrorBoundary from '../ErrorBoundary';
import { playMoveSound, findCheckedKingSquare, setMuted } from '../lib/sound';
import OpeningExplorer from '../components/OpeningExplorer';
import GameReview from '../components/GameReview';
import { buildPgnWithNag } from '../MoveClassification';
import { copyShareLink, decodeGameFromParams } from '../lib/share';
import { saveGame } from '../lib/gameHistory';

// Lazy load heavy components for better initial load time
const EvaluationSection = React.lazy(() => import('../EvaluationSection'));
const ChessboardContainer = React.lazy(() => import('../ChessboardContainer'));
const Controls = React.lazy(() => import('../Controls'));

export default function AnalysisPage() {
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [userColor, setUserColor] = useState('white');
  const { isLoading, showSkeleton, stepIndex, markReady } = useLoadingSequence({
    manual: true, // wait for Stockfish engine readiness
    stepCount: 4,
    stepTotalMs: 900,
  });
  const [isDepthAnalysisEnabled, setIsDepthAnalysisEnabled] = useState(false);
  const [isAutoMoveEnabled, setIsAutoMoveEnabled] = useState(false);
  const [multiPv, setMultiPv] = useState(1);

  // Reset confirmation dialog
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Promotion dialog state
  const [promotionPending, setPromotionPending] = useState(null); // { sourceSquare, targetSquare, side }

  // Game over banner state
  const [showArrow, setShowArrow] = useState(true);
  const [gameOverBanner, setGameOverBanner] = useState(null);
  const [gameResult, setGameResult] = useState(null); // { winner: 'white'|'black'|'draw'|null, reason: string }
  const [showGameReview, setShowGameReview] = useState(false);
  const savedGameIdRef = useRef(null);

  const [showFenModal, setShowFenModal] = useState(false);
  const [showPgnModal, setShowPgnModal] = useState(false);
  const [fenInput, setFenInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [pgnHeaders] = useState({
    Event: '?', Site: '?',
    Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    Round: '?', White: '?', Black: '?', Result: '*',
  });

  // Sound toggle
  const [isMuted, setIsMuted] = useState(false);
  useEffect(() => { setMuted(isMuted); }, [isMuted]);

  // Engine settings
  const [movetime, setMovetime] = useState(1000);
  const [depth, setDepth] = useState(20);
  const [threads, setThreads] = useState(1);
  const [hashSize, setHashSize] = useState(64);

  const maxThreads = navigator.hardwareConcurrency || 4;
  const maxHashSize = (() => {
    if (navigator.deviceMemory) {
      const memoryInMB = Math.floor(navigator.deviceMemory * 1024);
      return Math.pow(2, Math.floor(Math.log2(memoryInMB / 2)));
    }
    return 2048;
  })();

  // ── Custom Hooks ─────────────────────────────────────────
  const history = useGameHistory();

  const handleBestMove = useCallback((gameCopy, moveResult) => {
    history.applyMove(gameCopy, moveResult, history.historyPointer, history.moves);
    playMoveSound(moveResult, gameCopy);
    if (gameCopy.isCheckmate()) {
      const winner = gameCopy.turn() === 'w' ? 'Black' : 'White';
      setGameResult({ winner: winner.toLowerCase(), reason: 'Checkmate' });
      setGameOverBanner(`♛ Checkmate! ${winner} wins!`);
    } else if (gameCopy.isDraw()) {
      setGameResult({ winner: 'draw', reason: 'Draw' });
      setGameOverBanner('🤝 Game ended in a draw');
    }
  }, [history]);

  const engine = useChessEngine({
    threads,
    hashSize,
    fen: history.fen,
    onBestMove: handleBestMove,
    multiPv,
  });

  // ── Derived state ─────────────────────────────────────────
  let whiteHeight = 50;
  if (engine.stockfishEval.score !== null) {
    if (engine.stockfishEval.type === 'mate') {
      whiteHeight = engine.stockfishEval.score > 0 ? 100 : 0;
    } else {
      const scoreInPawns = engine.stockfishEval.score / 100;
      const clampedScore = Math.max(-10, Math.min(10, scoreInPawns));
      whiteHeight = 50 + clampedScore * 5;
    }
    if (boardOrientation === 'black') whiteHeight = 100 - whiteHeight;
  }

  // ── Auto-import shared game from URL params ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const { pgn: sharedPgn, result: sharedResult } = decodeGameFromParams(params);
    if (sharedPgn) {
      try {
        history.importPgn(sharedPgn, engine.sendCommand);
        if (sharedResult) {
          setGameResult(sharedResult);
          if (sharedResult.winner === 'draw') {
            setGameOverBanner('🤝 ' + (sharedResult.reason || 'Draw'));
          } else {
            const winnerLabel = sharedResult.winner === 'white' ? 'White' : 'Black';
            setGameOverBanner(`♛ ${winnerLabel} wins!` + (sharedResult.reason ? ' (' + sharedResult.reason + ')' : ''));
          }
        }
        // Clean URL params after importing (keep the path clean)
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.warn('Failed to import shared game:', err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Natural loading: wait for engine + lazy components + PGN import ──
  useEffect(() => {
    if (!engine.engineReady) return;
    // Give a small grace period for lazy Suspense components to settle, then mark ready
    const timer = setTimeout(() => markReady(), 200);
    return () => clearTimeout(timer);
  }, [engine.engineReady, markReady]);

  // ── Auto-move ─────────────────────────────────────────────
  const makeAutoOpponentMove = useCallback(() => {
    engine.sendCommand('stop');
    engine.sendCommand(`position fen ${history.fen}`);
    if (isDepthAnalysisEnabled) {
      engine.sendCommand(`go depth ${depth}`);
    } else {
      engine.sendCommand(`go movetime ${movetime}`);
    }
  }, [history.fen, isDepthAnalysisEnabled, depth, movetime, engine]);

  // ── Move handlers ─────────────────────────────────────────
  const executeMove = useCallback((sourceSquare, targetSquare, promotion = 'q') => {
    const gameCopy = new Chess(history.fen);
    const moveOptions = { from: sourceSquare, to: targetSquare, promotion };

    const side = history.fen.split(' ')[1];
    engine.prepareClassification(side);

    const move = gameCopy.move(moveOptions);
    if (move === null) {
      toast.error('Illegal move!');
      engine.cancelClassification();
      return false;
    }

    playMoveSound(move, gameCopy);

    const newFen = gameCopy.fen();
    history.applyMove(gameCopy, move, history.historyPointer, history.moves);
    history.pushHistory(newFen, history.historyPointer, history.moveHistory);
    engine.sliceClassifications(history.historyPointer);
    engine.sendCommand(`position fen ${newFen}`);

    // Check for game-ending conditions
    if (gameCopy.isCheckmate()) {
      const winner = gameCopy.turn() === 'w' ? 'Black' : 'White';
      setGameResult({ winner: winner.toLowerCase(), reason: 'Checkmate' });
      setGameOverBanner(`♛ Checkmate! ${winner} wins!`);
    } else if (gameCopy.isStalemate()) {
      setGameResult({ winner: 'draw', reason: 'Stalemate' });
      setGameOverBanner('🤝 Stalemate! The game is a draw.');
    } else if (gameCopy.isDraw()) {
      let reason = 'Draw';
      if (gameCopy.isThreefoldRepetition()) reason = 'Threefold repetition';
      else if (gameCopy.isInsufficientMaterial()) reason = 'Insufficient material';
      else reason = 'Draw';
      setGameResult({ winner: 'draw', reason });
      setGameOverBanner(`🤝 ${reason}`);
    }

    return true;
  }, [history, engine]);

  const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
    const gameCopy = new Chess(history.fen);
    const piece = gameCopy.get(sourceSquare);

    // Check for pawn promotion - show dialog instead of auto-queening
    if (piece && piece.type === 'p' &&
      ((piece.color === 'w' && targetSquare[1] === '8') ||
       (piece.color === 'b' && targetSquare[1] === '1'))) {
      setPromotionPending({ sourceSquare, targetSquare, side: piece.color });
      return false; // Don't execute yet, wait for promotion choice
    }

    return executeMove(sourceSquare, targetSquare, 'q');
  }, [history.fen, executeMove]);

  const handlePromotionChoice = useCallback((piece) => {
    if (!promotionPending) return;
    const { sourceSquare, targetSquare } = promotionPending;
    setPromotionPending(null);
    executeMove(sourceSquare, targetSquare, piece);
  }, [promotionPending, executeMove]);

  const undoMove = () => {
    // Bugfix: history tidak punya moveClassifications — pakai engine
    engine.sliceClassifications(engine.moveClassifications.length - 1);
    history.undo(history.historyPointer, history.moveHistory, history.moves, engine.sendCommand);
  };

  const redoMove = () => {
    const result = history.redo(history.historyPointer, history.moveHistory, history.moves, engine.sendCommand);
    if (result.addLabel) engine.addClassification(result.addLabel);
  };

  // ── Auto-save game to DB when it ends ──
  useEffect(() => {
    if (gameResult && !savedGameIdRef.current && history.moves.length > 0) {
      const pgn = buildPgnWithNag(pgnHeaders, history.moves, engine.moveClassifications);
      saveGame({
        pgn,
        result: gameResult,
        moves: history.moves,
        fen: history.fen,
        source: 'analysis',
      }).then(saved => {
        if (saved) {
          savedGameIdRef.current = saved.id;
          toast.success('Game saved to history!', { autoClose: 2000 });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameResult]);

  const confirmReset = () => {
    setShowResetConfirm(false);
    setShowGameReview(false);
    setGameOverBanner(null);
    setGameResult(null);
    savedGameIdRef.current = null;
    engine.resetEval();
    engine.resetClassifications();
    history.reset(engine.sendCommand);
  };

  const requestReset = () => {
    // If no moves have been played, reset immediately
    if (history.moves.length === 0) {
      confirmReset();
    } else {
      setShowResetConfirm(true);
    }
  };

  const handleMultiPvChange = (value) => {
    setMultiPv(value);
  };

  const jumpToMove = (moveIndex) => {
    // Navigate to a specific move in the history
    if (moveIndex >= 0 && moveIndex < history.moveHistory.length) {
      history.jumpToMove(moveIndex, history.moveHistory, history.moves, engine.sendCommand);
    }
  };

  /**
   * Play a sequence of PV (principal variation) moves from the engine.
   * Clicks on a PV move play all moves up to and including that index.
   */
  const playPvLine = useCallback((pvMoves, upToIndex) => {
    if (!pvMoves || pvMoves.length === 0 || upToIndex < 0) return;

    const movesToPlay = pvMoves.slice(0, upToIndex + 1);
    const currentGame = new Chess(history.fen);
    const moveResults = [];

    for (const san of movesToPlay) {
      try {
        const result = currentGame.move(san, { sloppy: true });
        if (result) {
          moveResults.push(result);
          // Only play sound for the first move to avoid cacophony
          if (moveResults.length === 1) playMoveSound(result, currentGame);
        } else {
          break;
        }
      } catch (err) {
        console.warn('playPvLine: Invalid PV move', san, err);
        break;
      }
    }

    if (moveResults.length === 0) return;

    // Batch apply all moves at once via the sequence function
    history.applyMoveSequence(
      currentGame,
      moveResults,
      history.historyPointer,
      history.moves,
      history.moveHistory,
      engine.sendCommand
    );
  }, [history, engine]);

  const flipBoard = () => setBoardOrientation((p) => (p === 'white' ? 'black' : 'white'));

  const checkedKingSquare = findCheckedKingSquare(history.game);

  // ── Shortcut Guide Modal ──────────────────────────────────
  const [showShortcutGuide, setShowShortcutGuide] = useState(false);

  const SHORTCUTS = [
    { key: '←', action: 'Undo last move' },
    { key: '→', action: 'Redo next move' },
    { key: 'R', action: 'Reset / New game' },
    { key: 'F', action: 'Flip board orientation' },
    { key: 'Click move', action: 'Jump to position in move history' },
  ];

  // ── Keyboard Shortcuts ────────────────────────────────────
  const keyHandlers = useRef({});
  const modalStateRef = useRef(false);
  modalStateRef.current = showFenModal || showPgnModal || showResetConfirm || promotionPending !== null || showShortcutGuide;
  keyHandlers.current = { undoMove, redoMove, requestReset, flipBoard };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs or when modals are open
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (modalStateRef.current) return;

      const h = keyHandlers.current;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); h.undoMove(); break;
        case 'ArrowRight': e.preventDefault(); h.redoMove(); break;
        case 'r': case 'R': e.preventDefault(); h.requestReset(); break;
        case 'f': case 'F': e.preventDefault(); h.flipBoard(); break;
        case '?': e.preventDefault(); setShowShortcutGuide(p => !p); break;
        default: break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── FEN / PGN handlers ────────────────────────────────────
  const handleFenClick = () => { setFenInput(history.game.fen()); setShowFenModal(true); };

  const handleImportFen = () => {
    try {
      setGameOverBanner(null);
      engine.resetEval();
      engine.resetClassifications();
      history.importFen(fenInput, engine.sendCommand);
      toast.success('FEN imported successfully!');
      setShowFenModal(false);
    } catch (err) {
      console.warn('Failed to import FEN:', err);
      toast.error('Invalid FEN string.');
    }
  };

  const handleCopyFen = () => {
    try {
      navigator.clipboard.writeText(fenInput || history.game.fen());
      toast.success('FEN copied to clipboard!');
      setShowFenModal(false);
    } catch (err) { console.warn('Failed to copy FEN:', err); toast.error('Failed to copy FEN'); }
  };

  const handlePgnClick = () => {
    try {
      const movesArray = history.moves.length > 0 ? history.moves : history.game.history();
      // Use buildPgnWithNag which injects NAG ($1-$6) annotations from classifications
      const pgnStr = buildPgnWithNag(pgnHeaders, movesArray, engine.moveClassifications);
      setPgnInput(pgnStr);
    } catch (err) {
      console.warn('Failed to build PGN with NAG annotations, falling back to standard PGN:', err);
      setPgnInput(history.game.pgn());
    }
    setShowPgnModal(true);
  };

  const handleCopyPgn = () => {
    navigator.clipboard.writeText(pgnInput);
    toast.success('PGN copied to clipboard!');
    setShowPgnModal(false);
  };

  const handleDownloadPgn = () => {
    try {
      const sanitize = (s) => (s ? s.replace(/\s+/g, '_').replace(/[^\w-]/g, '') : '');
      let datePart = pgnHeaders.Date && !pgnHeaders.Date.includes('?')
        ? pgnHeaders.Date.replace(/\./g, '-') : new Date().toISOString().slice(0, 10);
      const white = sanitize(pgnHeaders.White) || 'White';
      const black = sanitize(pgnHeaders.Black) || 'Black';
      const filename = `${datePart}_${white}_vs_${black}.pgn`;
      const blob = new Blob([pgnInput], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success(`PGN downloaded: ${filename}`);
    } catch (err) { console.warn('Failed to download PGN:', err); toast.error('Failed to download PGN'); }
  };

  const handleImportPgn = () => {
    try {
      setGameOverBanner(null);
      engine.resetEval();
      engine.resetClassifications();
      history.importPgn(pgnInput, engine.sendCommand);
      toast.success('PGN imported successfully!');
      setShowPgnModal(false);
    } catch (err) { console.warn('Failed to import PGN:', err); toast.error('Invalid PGN string.'); }
  };

  return (
    <div className="sk-transition-wrap">
      {/* ── Skeleton (fades out) ── */}
      {showSkeleton && (
        <div className={`sk-fade-layer ${!isLoading ? 'sk-fade-out' : ''}`}>
          <AnalysisSkeleton stepIndex={stepIndex} />
        </div>
      )}

      {/* ── Real content (crossfade saat skeleton fade out) ── */}
      <div className={`sk-entering-content ${!isLoading ? 'sk-crossfade' : ''}`}>
        <div className="App">
      <main className="App-body">
        <Suspense fallback={<PanelSkeleton />}>
          <EvaluationSection
            evaluation={engine.stockfishEval}
            whiteHeight={whiteHeight}
            isDepthAnalysisEnabled={isDepthAnalysisEnabled}
            multiPvLines={engine.multiPvLines}
            onClickPvMove={playPvLine}
          />
        </Suspense>

        <div style={{ gridArea: 'chessboard' }}>
          <Suspense fallback={<BoardSkeleton />}>
            <ErrorBoundary componentName="Analysis Chessboard">
            <ChessboardContainer
              fen={history.fen}
              onDrop={onDrop}
              boardOrientation={boardOrientation}
              lastMove={history.lastMove}
              isAutoMoveEnabled={isAutoMoveEnabled}
              makeAutoOpponentMove={makeAutoOpponentMove}
              userColor={userColor}
              isOnlineMode={false}
              isSpectator={false}
              checkedKingSquare={checkedKingSquare}
              showArrow={showArrow}
            />
            </ErrorBoundary>
          </Suspense>
        </div>

        <Suspense fallback={<PanelSkeleton />}>
          <Controls
            onReset={requestReset}
            onFlip={flipBoard}
            onUndo={undoMove}
            onRedo={redoMove}
            canUndo={history.historyPointer > 0}
            canRedo={history.historyPointer < history.moveHistory.length - 1}
            engineSettings={{ movetime, threads, hashSize, maxThreads, maxHashSize, depth, isDepthAnalysisEnabled }}
            setEngineSettings={{ setMovetime, setThreads, setHashSize, setDepth, setIsDepthAnalysisEnabled }}
            onFenClick={handleFenClick}
            onPgnClick={handlePgnClick}
            isAutoMoveEnabled={isAutoMoveEnabled}
            setIsAutoMoveEnabled={setIsAutoMoveEnabled}
            userColor={userColor}
            setUserColor={setUserColor}
            backendUrl={engine.backendUrl}
            engineMode={engine.engineMode}
            isOnlineMode={false}
            multiPv={multiPv}
            onMultiPvChange={handleMultiPvChange}
            showArrow={showArrow}
            onShowArrowChange={setShowArrow}
            onKeyboardShortcuts={() => setShowShortcutGuide(true)}
            isMuted={isMuted}
            onMuteChange={setIsMuted}
          />
        </Suspense>

        <OpeningExplorer moves={history.moves} />

        <Suspense fallback={<MoveHistorySkeleton />}>
          <MoveHistory
            moves={history.moves}
            classifications={engine.moveClassifications}
            currentMoveIndex={history.historyPointer}
            onJumpToMove={jumpToMove}
          />
        </Suspense>

        {/* Game Over Banner */}
        {/* Reset Confirmation Dialog */}
        {showResetConfirm && (
          <AccessibleDialog isOpen={true} onClose={() => setShowResetConfirm(false)} labelledBy="reset-confirm-title">
            <div className="reset-confirm-dialog">
              <h2 id="reset-confirm-title">Reset Game?</h2>
              <p>This will clear the board, move history, and all evaluations. This action cannot be undone.</p>
              <div className="button-group">
                <button className="button-secondary" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                <button className="button-danger" onClick={confirmReset}>Reset Game</button>
              </div>
            </div>
          </AccessibleDialog>
        )}

        {gameOverBanner && (
          <div className="game-over-banner" role="alert">
            <span className="game-over-text">{gameOverBanner}</span>
            <button className="button-primary banner-action-btn" onClick={requestReset}>
              New Game
            </button>
            <button className="button-secondary banner-action-btn" onClick={() => setShowGameReview(true)}>
              Review Game
            </button>
            <button
              className="button-secondary banner-action-btn"
              onClick={async () => {
                try {
                  const pgn = buildPgnWithNag(pgnHeaders, history.moves, engine.moveClassifications);
                  const ok = await copyShareLink(pgn, gameResult);
                  if (ok) toast.success('Share link copied to clipboard!');
                  else toast.error('Failed to copy share link');
                } catch (err) {
                  console.error('Failed to generate share link:', err);
                  toast.error('Failed to generate share link');
                }
              }}
            >
              Share
            </button>
            <button className="button-secondary banner-action-btn" onClick={() => setGameOverBanner(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* Game Review Modal */}
        <GameReview
          isOpen={showGameReview}
          onClose={() => setShowGameReview(false)}
          onNewGame={requestReset}
          classifications={engine.moveClassifications}
          moves={history.moves}
          result={gameResult}
        />

        {/* Promotion Dialog - menggunakan AccessibleDialog native <dialog> untuk konsistensi aksesibilitas */}
        {promotionPending && (
          <AccessibleDialog isOpen={true} onClose={() => setPromotionPending(null)} labelledBy="promotion-dialog-title">
            <div className="promotion-dialog">
              <h2 id="promotion-dialog-title" className="promotion-title">Choose promotion piece</h2>
              <div className="promotion-choices">
                {['q', 'r', 'b', 'n'].map(piece => (
                  <button
                    key={piece}
                    className="promotion-btn"
                    onClick={() => handlePromotionChoice(piece)}
                    aria-label={`Promote to ${piece === 'q' ? 'Queen' : piece === 'r' ? 'Rook' : piece === 'b' ? 'Bishop' : 'Knight'}`}
                  >
                    {piece === 'q' && '♕'}
                    {piece === 'r' && '♖'}
                    {piece === 'b' && '♗'}
                    {piece === 'n' && '♘'}
                    <span className="promotion-label">
                      {piece === 'q' ? 'Queen' : piece === 'r' ? 'Rook' : piece === 'b' ? 'Bishop' : 'Knight'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </AccessibleDialog>
        )}
      </main>

      <Modal isOpen={showFenModal} onClose={() => setShowFenModal(false)} title="FEN">
        <textarea
          rows="3"
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
          placeholder="Enter FEN string"
        />
        <div className="button-group">
          <button className="button-secondary" onClick={handleCopyFen}>Copy</button>
          <button className="button-primary" onClick={handleImportFen}>Import</button>
        </div>
      </Modal>

      {/* ── Keyboard Shortcuts Guide Modal ── */}
      {showShortcutGuide && (
        <AccessibleDialog isOpen={true} onClose={() => setShowShortcutGuide(false)} labelledBy="shortcut-guide-title">
          <div className="shortcut-guide-card">
            <h2 id="shortcut-guide-title" className="shortcut-guide-title">
              <Zap size={22} />
              Keyboard Shortcuts
            </h2>
            <div className="shortcut-guide-list">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="shortcut-guide-row">
                  <kbd className="shortcut-guide-key">{s.key}</kbd>
                  <span className="shortcut-guide-action">{s.action}</span>
                </div>
              ))}
            </div>
            <p className="shortcut-guide-hint">Press <kbd>?</kbd> to toggle this guide anytime.</p>
            <div className="shortcut-guide-actions">
              <button className="button-primary" onClick={() => setShowShortcutGuide(false)}>
                Got it
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      <Modal isOpen={showPgnModal} onClose={() => setShowPgnModal(false)} title="PGN">
        <textarea
          rows="10"
          value={pgnInput}
          onChange={(e) => setPgnInput(e.target.value)}
          placeholder="Enter PGN string"
        />
        <div className="button-group">
          <button className="button-secondary" onClick={handleCopyPgn}>Copy</button>
          <button className="button-primary" onClick={handleImportPgn}>Import</button>
          <button className="button-secondary" onClick={handleDownloadPgn}>Download .pgn</button>
        </div>
      </Modal>
        </div>
      </div>
    </div>
  );
}
