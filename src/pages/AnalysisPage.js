import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import { createEngine } from '../engine';
import Modal from '../Modal';
import { calculateLoss, classifyMove, LABELS } from '../MoveClassification';
import MoveHistory from '../MoveHistory';

// Lazy load components for better initial load time
const EvaluationSection = React.lazy(() => import('../EvaluationSection'));
const ChessboardContainer = React.lazy(() => import('../ChessboardContainer'));
const Controls = React.lazy(() => import('../Controls'));

export default function AnalysisPage() {
  const navigate = useNavigate();
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState([game.fen()]);
  const [moves, setMoves] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(0);
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [userColor, setUserColor] = useState('white');
  const [stockfishEval, setStockfishEval] = useState({ score: null, type: 'cp' });
  const [lastMove, setLastMove] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDepthAnalysisEnabled, setIsDepthAnalysisEnabled] = useState(false);
  const [isAutoMoveEnabled, setIsAutoMoveEnabled] = useState(false);
  const [moveClassifications, setMoveClassifications] = useState([]);
  
  const [showFenModal, setShowFenModal] = useState(false);
  const [showPgnModal, setShowPgnModal] = useState(false);
  const [fenInput, setFenInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [pgnHeaders, setPgnHeaders] = useState({
    Event: '?',
    Site: '?',
    Date: new Date().toISOString().slice(0,10).replace(/-/g, '.'),
    Round: '?',
    White: '?',
    Black: '?',
    Result: '*'
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

  const engine = useRef(null);
  const analysisFenRef = useRef(null);
  const evalBeforeRef = useRef(null);
  const pendingClassifyRef = useRef(false);
  const pendingSideRef = useRef(null);
  const pendingIsEngineRef = useRef(false);
  const stockfishEvalRef = useRef(stockfishEval);
  const fenRef = useRef(fen);

  const sendCommand = React.useCallback((command) => {
    if (engine.current) {
      engine.current.sendCommand(command);
    }
  }, []);

  const makeAutoOpponentMove = React.useCallback(() => {
    sendCommand('stop');
    const currentFen = fen;
    analysisFenRef.current = currentFen;
    sendCommand(`position fen ${currentFen}`);
    if (isDepthAnalysisEnabled) {
      sendCommand(`go depth ${depth}`);
    } else {
      sendCommand(`go movetime ${movetime}`);
    }
  }, [fen, isDepthAnalysisEnabled, depth, movetime, sendCommand]);

  useEffect(() => {
    stockfishEvalRef.current = stockfishEval;
    fenRef.current = fen;
  }, [stockfishEval, fen, makeAutoOpponentMove]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const engineMode = process.env.REACT_APP_ENGINE_MODE || 'browser';
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

  useEffect(() => {
    engine.current = createEngine(engineMode, backendUrl);

    const cleanupOutput = engine.current.onOutput((data) => {
      if (data.type === 'info' && data.score) {
        const newEval = {
          score: data.score.value,
          type: data.score.type,
          depth: data.depth,
          nodes: data.nodes,
          nps: data.nps,
          tbhits: data.tbhits,
        };
        setStockfishEval(newEval);

        if (pendingClassifyRef.current) {
          let beforeScore = evalBeforeRef.current;
          let afterScore = data.score.value;

          if (data.score.type === 'mate') {
            beforeScore = beforeScore || 0;
            afterScore = afterScore > 0 ? 10000 : -10000;
          }

          const side = pendingSideRef.current;
          const isEngine = pendingIsEngineRef.current;

          const loss = calculateLoss(beforeScore, afterScore, side);
          const classification = classifyMove(loss, beforeScore, afterScore, isEngine);

          setMoveClassifications((prev) => [...prev, classification]);
          pendingClassifyRef.current = false;
          pendingIsEngineRef.current = false;
          pendingSideRef.current = null;
        }
      } else if (data.type === 'bestmove') {
        const turn = fenRef.current.split(' ')[1];
        const sideThatMoved = turn;
        evalBeforeRef.current = stockfishEvalRef.current.score;
        pendingClassifyRef.current = true;
        pendingSideRef.current = sideThatMoved;
        pendingIsEngineRef.current = true;

        const gameCopy = new Chess(fenRef.current);
        try {
          const moveResult = gameCopy.move(data.move, { sloppy: true });
          if (moveResult) {
            setFen(gameCopy.fen());
            setGame(gameCopy);
            if (moveResult.san) setMoves((prev) => [...prev, moveResult.san]);
            setLastMove({ from: moveResult.from, to: moveResult.to });
          }
        } catch (err) {
          // Ignore
        }
      }
    });

    engine.current.onConnect(() => {
      sendCommand('uci');
      sendCommand(`setoption name Threads value ${threads}`);
      sendCommand(`setoption name Hash value ${hashSize}`);
      sendCommand('isready');
    });

    return () => {
      cleanupOutput();
      engine.current.disconnect();
    };
  }, [engineMode, backendUrl, threads, hashSize, sendCommand]);

  let whiteHeight = 50;
  if (stockfishEval.score !== null) {
    if (stockfishEval.type === 'mate') {
      whiteHeight = stockfishEval.score > 0 ? 100 : 0;
    } else {
      const scoreInPawns = stockfishEval.score / 100;
      const clampedScore = Math.max(-10, Math.min(10, scoreInPawns));
      whiteHeight = 50 + clampedScore * 5;
    }
    if (boardOrientation === 'black') {
      whiteHeight = 100 - whiteHeight;
    }
  }

  const onDrop = ({ sourceSquare, targetSquare }) => {
    const gameCopy = new Chess(fen);
    const moveOptions = { from: sourceSquare, to: targetSquare };

    const piece = gameCopy.get(sourceSquare);
    if (piece && piece.type === 'p' &&
       ((piece.color === 'w' && targetSquare[1] === '8') ||
        (piece.color === 'b' && targetSquare[1] === '1'))) {
      moveOptions.promotion = 'q';
    }

    const turnBeforeMove = fen.split(' ')[1];
    const sideThatMoved = turnBeforeMove;
    evalBeforeRef.current = stockfishEval.score;
    pendingClassifyRef.current = true;
    pendingSideRef.current = sideThatMoved;
    pendingIsEngineRef.current = false;

    const move = gameCopy.move(moveOptions);

    if (move === null) {
      toast.error('Illegal move!');
      pendingClassifyRef.current = false;
      return false;
    }

    const newFen = gameCopy.fen();
    setFen(newFen);
    setLastMove({ from: move.from, to: move.to });
    setGame(gameCopy);
    
    const newHistory = moveHistory.slice(0, historyPointer + 1);
    setMoveHistory([...newHistory, newFen]);
    
    const newMoves = moves.slice(0, historyPointer);
    if (move.san) newMoves.push(move.san);
    setMoves(newMoves);
    
    setMoveClassifications(prev => prev.slice(0, historyPointer));
    setHistoryPointer(newHistory.length);
    sendCommand(`position fen ${newFen}`);

    return true;
  };

  const undoMove = () => {
    if (historyPointer > 0) {
      setMoveClassifications(prev => prev.slice(0, -1));
      const newPointer = historyPointer - 1;
      const newFen = moveHistory[newPointer];
      const newGame = new Chess(newFen);
      const lastMove = moves[newPointer];
      let lastMoveSquares = null;
      if (lastMove && newPointer < moveHistory.length - 1) {
        try {
          const tempGame = new Chess(moveHistory[newPointer]);
          const moveObj = tempGame.move(lastMove, { sloppy: true });
          if (moveObj) {
            lastMoveSquares = { from: moveObj.from, to: moveObj.to };
          }
        } catch (err) {}
      }
      setHistoryPointer(newPointer);
      setFen(newFen);
      setGame(newGame);
      setLastMove(lastMoveSquares);
      sendCommand('ucinewgame');
      sendCommand(`position fen ${newFen}`);
    } else {
      toast.info('No moves to undo.');
    }
  };

  const redoMove = () => {
    if (historyPointer < moveHistory.length - 1) {
      setMoveClassifications(prev => [...prev, LABELS.GOOD]);
      const newPointer = historyPointer + 1;
      const newFen = moveHistory[newPointer];
      const newGame = new Chess(newFen);
      const lastMove = moves[newPointer - 1];
      let lastMoveSquares = null;
      if (lastMove) {
        try {
          const tempGame = new Chess(moveHistory[newPointer - 1]);
          const moveObj = tempGame.move(lastMove, { sloppy: true });
          if (moveObj) {
            lastMoveSquares = { from: moveObj.from, to: moveObj.to };
          }
        } catch (err) {}
      }
      setHistoryPointer(newPointer);
      setFen(newFen);
      setGame(newGame);
      setLastMove(lastMoveSquares);
      sendCommand('ucinewgame');
      sendCommand(`position fen ${newFen}`);
    } else {
      toast.info('No moves to redo.');
    }
  };

  const resetGame = () => {
    const newGame = new Chess();
    const initialFen = newGame.fen();
    setGame(newGame);
    setFen(initialFen);
    setMoves([]);
    setLastMove(null);
    setStockfishEval({ score: null, type: 'cp' });
    setMoveHistory([initialFen]);
    setHistoryPointer(0);
    setMoveClassifications([]);
    pendingClassifyRef.current = false;
    toast.info('New game started.');
    sendCommand('ucinewgame');
  };

  const flipBoard = () => setBoardOrientation(p => (p === 'white' ? 'black' : 'white'));

  const handleFenClick = () => {
    setFenInput(game.fen());
    setShowFenModal(true);
  };

  const handlePgnClick = () => {
    try {
      const buildPGN = (headers, movesArray) => {
        const headerLines = Object.entries(headers).map(([k, v]) => `[${k} "${v}"]`).join('\n');
        const exportGame = new Chess();
        (movesArray || []).forEach(m => exportGame.move(m, { sloppy: true }));
        let movesStr = exportGame.pgn();
        movesStr = movesStr.replace(/^(?:\[.*\]\s*)+/g, '').trim();
        return `${headerLines}\n\n${movesStr}`.trim();
      };
      const pgnStr = buildPGN(pgnHeaders, moves.length > 0 ? moves : game.history());
      setPgnInput(pgnStr);
    } catch (e) {
      setPgnInput(game.pgn());
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
        ? pgnHeaders.Date.replace(/\./g, '-').replace(/\//g, '-') 
        : new Date().toISOString().slice(0, 10);
      const white = sanitize(pgnHeaders.White) || 'White';
      const black = sanitize(pgnHeaders.Black) || 'Black';
      const filename = `${datePart}_${white}_vs_${black}.pgn`;

      const blob = new Blob([pgnInput], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`PGN downloaded: ${filename}`);
    } catch (e) {
      toast.error('Failed to download PGN');
    }
  };

  const handleImportFen = () => {
    try {
      const newGame = new Chess(fenInput);
      const newFen = newGame.fen();
      setGame(newGame);
      setFen(newFen);
      setLastMove(null);
      setStockfishEval({ score: null, type: 'cp' });
      setMoveHistory([newFen]);
      setHistoryPointer(0);
      setMoveClassifications([]);
      toast.success('FEN imported successfully!');
      setShowFenModal(false);
      sendCommand(`position fen ${newFen}`);
    } catch (error) {
      toast.error('Invalid FEN string.');
    }
  };

  const handleCopyFen = () => {
    try {
      navigator.clipboard.writeText(fenInput || game.fen());
      toast.success('FEN copied to clipboard!');
      setShowFenModal(false);
    } catch (e) {
      toast.error('Failed to copy FEN');
    }
  };

  const handleImportPgn = () => {
    try {
      const newGame = new Chess();
      newGame.loadPgn(pgnInput);
      const newFen = newGame.fen();
      setGame(newGame);
      setFen(newFen);

      const pgnMoves = newGame.history();
      setMoves(pgnMoves);
      setLastMove(null);
      setStockfishEval({ score: null, type: 'cp' });

      const history = newGame.history({ verbose: true });
      const newMoveHistory = [new Chess().fen()];
      const tempGame = new Chess();
      history.forEach(move => {
        tempGame.move(move);
        newMoveHistory.push(tempGame.fen());
      });
      setMoveHistory(newMoveHistory);
      setHistoryPointer(newMoveHistory.length - 1);
      toast.success('PGN imported successfully!');
      setShowPgnModal(false);
      sendCommand(`position fen ${newFen}`);
    } catch (error) {
      toast.error('Invalid PGN string.');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="App">
      <header className="App-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' }}>
        <h1>ChessWeb - Analysis</h1>
        <button onClick={() => navigate('/')} className="button-secondary" style={{ height: '40px' }}>
          Back to Home
        </button>
      </header>
      <main className="App-body">
        <Suspense fallback={<div className="panel">Loading...</div>}>
          <EvaluationSection
            evaluation={stockfishEval}
            whiteHeight={whiteHeight}
            isDepthAnalysisEnabled={isDepthAnalysisEnabled}
          />
        </Suspense>

        <div style={{ gridArea: 'chessboard' }}>
          <Suspense fallback={<div className="chessboard-container-wrapper">Loading...</div>}>
            <ChessboardContainer
              fen={fen}
              onDrop={onDrop}
              boardOrientation={boardOrientation}
              lastMove={lastMove}
              isAutoMoveEnabled={isAutoMoveEnabled}
              makeAutoOpponentMove={makeAutoOpponentMove}
              userColor={userColor}
              isOnlineMode={false}
              isSpectator={false}
            />
          </Suspense>
        </div>

        <Suspense fallback={<div className="panel">Loading...</div>}>
          <Controls
            onReset={resetGame}
            onFlip={flipBoard}
            onUndo={undoMove}
            onRedo={redoMove}
            canUndo={historyPointer > 0}
            canRedo={historyPointer < moveHistory.length - 1}
            engineSettings={{ movetime, threads, hashSize, maxThreads, maxHashSize, depth, isDepthAnalysisEnabled }}
            setEngineSettings={{ setMovetime, setThreads, setHashSize, setDepth, setIsDepthAnalysisEnabled }}
            sendCommand={sendCommand}
            onFenClick={handleFenClick}
            onPgnClick={handlePgnClick}
            isAutoMoveEnabled={isAutoMoveEnabled}
            setIsAutoMoveEnabled={setIsAutoMoveEnabled}
            userColor={userColor}
            setUserColor={setUserColor}
            backendUrl={backendUrl}
            engineMode={engineMode}
            isOnlineMode={false}
          />
        </Suspense>

        <Suspense fallback={<div className="panel">Loading...</div>}>
          <MoveHistory moves={moves} classifications={moveClassifications} />
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