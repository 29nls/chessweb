import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import Modal from '../Modal';
import MoveHistory from '../MoveHistory';
import { useChessEngine } from '../hooks/useChessEngine';
import { useGameHistory } from '../hooks/useGameHistory';
import { BoardSkeleton, PanelSkeleton, MoveHistorySkeleton } from '../components/SkeletonLoader';
import { playMoveSound, findCheckedKingSquare } from '../lib/sound';
import OpeningExplorer from '../components/OpeningExplorer';

// Lazy load heavy components for better initial load time
const EvaluationSection = React.lazy(() => import('../EvaluationSection'));
const ChessboardContainer = React.lazy(() => import('../ChessboardContainer'));
const Controls = React.lazy(() => import('../Controls'));

export default function AnalysisPage() {
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [userColor, setUserColor] = useState('white');
  const [isLoading, setIsLoading] = useState(true);
  const [isDepthAnalysisEnabled, setIsDepthAnalysisEnabled] = useState(false);
  const [isAutoMoveEnabled, setIsAutoMoveEnabled] = useState(false);
  const [multiPv, setMultiPv] = useState(1);

  const [showFenModal, setShowFenModal] = useState(false);
  const [showPgnModal, setShowPgnModal] = useState(false);
  const [fenInput, setFenInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [pgnHeaders] = useState({
    Event: '?', Site: '?',
    Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    Round: '?', White: '?', Black: '?', Result: '*',
  });

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
    history.applyMove(gameCopy, moveResult);
    playMoveSound(moveResult, gameCopy);
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

  // ── Loading timer ─────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

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
  const onDrop = ({ sourceSquare, targetSquare }) => {
    const gameCopy = new Chess(history.fen);
    const moveOptions = { from: sourceSquare, to: targetSquare };

    const piece = gameCopy.get(sourceSquare);
    if (piece && piece.type === 'p' &&
      ((piece.color === 'w' && targetSquare[1] === '8') ||
       (piece.color === 'b' && targetSquare[1] === '1'))) {
      moveOptions.promotion = 'q';
    }

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
    history.applyMove(gameCopy, move);
    history.pushHistory(newFen, history.historyPointer, history.moveHistory);
    engine.sliceClassifications(history.historyPointer);
    engine.sendCommand(`position fen ${newFen}`);
    return true;
  };

  const undoMove = () => {
    engine.sliceClassifications(history.moveClassifications ? history.moveClassifications.length - 1 : 0);
    history.undo(history.historyPointer, history.moveHistory, history.moves, engine.sendCommand);
  };

  const redoMove = () => {
    const result = history.redo(history.historyPointer, history.moveHistory, history.moves, engine.sendCommand);
    if (result.addLabel) engine.addClassification(result.addLabel);
  };

  const resetGame = () => {
    engine.resetEval();
    engine.resetClassifications();
    history.reset(engine.sendCommand);
  };

  const handleMultiPvChange = (value) => {
    setMultiPv(value);
    engine.sendCommand(`setoption name MultiPV value ${value}`);
  };

  const flipBoard = () => setBoardOrientation((p) => (p === 'white' ? 'black' : 'white'));

  const checkedKingSquare = findCheckedKingSquare(history.game);

  // ── FEN / PGN handlers ────────────────────────────────────
  const handleFenClick = () => { setFenInput(history.game.fen()); setShowFenModal(true); };

  const handleImportFen = () => {
    try {
      engine.resetEval();
      engine.resetClassifications();
      history.importFen(fenInput, engine.sendCommand);
      toast.success('FEN imported successfully!');
      setShowFenModal(false);
    } catch {
      toast.error('Invalid FEN string.');
    }
  };

  const handleCopyFen = () => {
    try {
      navigator.clipboard.writeText(fenInput || history.game.fen());
      toast.success('FEN copied to clipboard!');
      setShowFenModal(false);
    } catch { toast.error('Failed to copy FEN'); }
  };

  const handlePgnClick = () => {
    try {
      const buildPGN = (headers, movesArray) => {
        const headerLines = Object.entries(headers).map(([k, v]) => `[${k} "${v}"]`).join('\n');
        const exportGame = new Chess();
        (movesArray || []).forEach((m) => exportGame.move(m, { sloppy: true }));
        let movesStr = exportGame.pgn();
        movesStr = movesStr.replace(/^(?:\[.*\]\s*)+/g, '').trim();
        return `${headerLines}\n\n${movesStr}`.trim();
      };
      const pgnStr = buildPGN(pgnHeaders, history.moves.length > 0 ? history.moves : history.game.history());
      setPgnInput(pgnStr);
    } catch {
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
    } catch { toast.error('Failed to download PGN'); }
  };

  const handleImportPgn = () => {
    try {
      engine.resetEval();
      engine.resetClassifications();
      history.importPgn(pgnInput, engine.sendCommand);
      toast.success('PGN imported successfully!');
      setShowPgnModal(false);
    } catch { toast.error('Invalid PGN string.'); }
  };

  // ── Skeleton Loading State ────────────────────────────────
  if (isLoading) {
    return (
      <div className="App">
        <main className="App-body">
          <PanelSkeleton />
          <div style={{ gridArea: 'chessboard' }}><BoardSkeleton /></div>
          <PanelSkeleton />
          <MoveHistorySkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="App">
      <main className="App-body">
        <Suspense fallback={<PanelSkeleton />}>
          <EvaluationSection
            evaluation={engine.stockfishEval}
            whiteHeight={whiteHeight}
            isDepthAnalysisEnabled={isDepthAnalysisEnabled}
            multiPvLines={engine.multiPvLines}
          />
        </Suspense>

        <div style={{ gridArea: 'chessboard' }}>
          <Suspense fallback={<BoardSkeleton />}>
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
            />
          </Suspense>
        </div>

        <Suspense fallback={<PanelSkeleton />}>
          <Controls
            onReset={resetGame}
            onFlip={flipBoard}
            onUndo={undoMove}
            onRedo={redoMove}
            canUndo={history.historyPointer > 0}
            canRedo={history.historyPointer < history.moveHistory.length - 1}
            engineSettings={{ movetime, threads, hashSize, maxThreads, maxHashSize, depth, isDepthAnalysisEnabled }}
            setEngineSettings={{ setMovetime, setThreads, setHashSize, setDepth, setIsDepthAnalysisEnabled }}
            sendCommand={engine.sendCommand}
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
          />
        </Suspense>

        <OpeningExplorer moves={history.moves} />

        <Suspense fallback={<MoveHistorySkeleton />}>
          <MoveHistory moves={history.moves} classifications={engine.moveClassifications} />
        </Suspense>
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
  );
}