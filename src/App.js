/* eslint-disable no-undef */
/* eslint-disable no-undef */
import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Chess } from 'chess.js';
import { ToastContainer, toast } from 'react-toastify';
import { createEngine } from './engine';
import { useOnlineGame } from './hooks/useOnlineGame';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import Modal from './Modal';
import { calculateLoss, classifyMove, LABELS } from './MoveClassification';
import MoveHistory from './MoveHistory';
import OnlineLobby, { OnlineStatusBar } from './OnlineLobby';

// Lazy load components for better initial load time
const EvaluationSection = React.lazy(() => import('./EvaluationSection'));
const ChessboardContainer = React.lazy(() => import('./ChessboardContainer'));
const Controls = React.lazy(() => import('./Controls'));
function App() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState([game.fen()]); // Initialize with starting FEN
  const [moves, setMoves] = useState([]); // SAN move list for PGN and reconstruction
  const [historyPointer, setHistoryPointer] = useState(0); // Pointer to current position in history
  const [boardOrientation, setBoardOrientation] = useState('white');
  const [userColor, setUserColor] = useState('white'); // New state for user's playing color
  const [stockfishEval, setStockfishEval] = useState({ score: null, type: 'cp' });
  const [lastMove, setLastMove] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDepthAnalysisEnabled, setIsDepthAnalysisEnabled] = useState(false); // New state for depth analysis toggle
  const [isAutoMoveEnabled, setIsAutoMoveEnabled] = useState(false);

  const [moveClassifications, setMoveClassifications] = useState([]);
  
  const [showFenModal, setShowFenModal] = useState(false);
  const [showPgnModal, setShowPgnModal] = useState(false);
  const [fenInput, setFenInput] = useState('');
  const [pgnInput, setPgnInput] = useState('');
  const [pgnHeaders, setPgnHeaders] = useState({
    Event: '?',
    Site: '?',
    Date: new Date().toISOString().slice(0,10).replace(/-/g, '.'), // default to today's date YYYY.MM.DD
    Round: '?',
    White: '?',
    Black: '?',
    Result: '*'
  });

  // Engine settings
  const [movetime, setMovetime] = useState(1000);
  const [depth, setDepth] = useState(20); // New state for search depth
  const [threads, setThreads] = useState(1);
  const [hashSize, setHashSize] = useState(64);
  
  // Calculate max values once (not state since they don't change)
  const maxThreads = navigator.hardwareConcurrency || 4;
  const maxHashSize = (() => {
    if (navigator.deviceMemory) {
      const memoryInMB = Math.floor(navigator.deviceMemory * 1024);
      return Math.pow(2, Math.floor(Math.log2(memoryInMB / 2)));
    }
    return 2048;
  })();

  // ─── Online Mode ───
  const [showLobby, setShowLobby] = useState(false);
  const online = useOnlineGame();
  const isOnlineMode = online.gameStatus === 'playing' || online.gameStatus === 'waiting';

  const engine = useRef(null);
  const analysisFenRef = useRef(null);
  const evalBeforeRef = useRef(null);
  const pendingClassifyRef = useRef(false);
  const pendingSideRef = useRef(null);
  const pendingIsEngineRef = useRef(false);
  const stockfishEvalRef = useRef(stockfishEval);
  const fenRef = useRef(fen);

  const sendCommand = React.useCallback((command) => {
    console.log('Sending command:', command);
    if (engine.current) {
      engine.current.sendCommand(command);
    } else {
      console.warn('Engine not ready, command not sent:', command);
    }
  }, []);

  const makeAutoOpponentMove = React.useCallback(() => {
    console.log('makeAutoOpponentMove called');
    sendCommand('stop'); // Stop any ongoing analysis

    const currentFen = fen; // Always analyze for the current FEN
    analysisFenRef.current = currentFen;
    sendCommand(`position fen ${currentFen}`);
    if (isDepthAnalysisEnabled) {
      sendCommand(`go depth ${depth}`);
    } else {
      sendCommand(`go movetime ${movetime}`);
    }
  }, [fen, isDepthAnalysisEnabled, depth, movetime, sendCommand]);

  // Keep refs in sync with state so the engine output handler (registered once)
  // always reads the latest values without re-subscribing.
  useEffect(() => {
    stockfishEvalRef.current = stockfishEval;
    fenRef.current = fen;
  }, [stockfishEval, fen, makeAutoOpponentMove]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500); // Shorter loading time
    return () => clearTimeout(timer);
  }, []);

// Engine mode: 'browser' (WASM, default — works on Vercel) or 'backend' (Socket.IO)
  const engineMode = process.env.REACT_APP_ENGINE_MODE || 'browser';
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

  // Initialize engine once (mode flag — default 'browser' for Vercel)
  useEffect(() => {
    engine.current = createEngine(engineMode, backendUrl);

    // Subscribe to engine output
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
          const classification = classifyMove(
            loss, beforeScore, afterScore, isEngine
          );

          setMoveClassifications((prev) => [...prev, classification]);
          pendingClassifyRef.current = false;
          pendingIsEngineRef.current = false;
          pendingSideRef.current = null;
        }
      } else if (data.type === 'bestmove') {
        console.log('Received bestmove from Stockfish:', data.move);

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
            console.log('Bestmove applied successfully. New FEN:', gameCopy.fen());
            setFen(gameCopy.fen());
            setGame(gameCopy);
            if (moveResult.san) setMoves((prev) => [...prev, moveResult.san]);
            setLastMove({ from: moveResult.from, to: moveResult.to });
          } else {
            console.warn('Failed to apply bestmove:', data.move);
          }
        } catch (err) {
          // Move already applied (e.g. duplicate bestmove for same position)
          console.warn('Skipping bestmove (already applied):', data.move);
        }
      }
    });

    // On connect: configure engine
    engine.current.onConnect(() => {
      console.log(`Engine connected (${engineMode})`);
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

  // ─── Online: Register move received callback ───
  const applyOpponentMove = useCallback((payload) => {
    const gameCopy = new Chess(fenRef.current);
    const moveOptions = { from: payload.from, to: payload.to };
    if (payload.promotion) moveOptions.promotion = payload.promotion;

    try {
      const moveResult = gameCopy.move(moveOptions);
      if (moveResult) {
        const newFen = gameCopy.fen();
        setFen(newFen);
        setGame(gameCopy);
        setLastMove({ from: moveResult.from, to: moveResult.to });

        // Update move history
        setMoveHistory(prev => {
          const newHistory = [...prev, newFen];
          setHistoryPointer(newHistory.length - 1);
          return newHistory;
        });

        if (moveResult.san) setMoves(prev => [...prev, moveResult.san]);

        // Check for game-ending conditions
        if (gameCopy.isCheckmate()) {
          const winner = gameCopy.turn() === 'w' ? 'black' : 'white';
          online.broadcastGameOver(winner, 'Checkmate!');
        } else if (gameCopy.isDraw()) {
          let reason = 'Draw';
          if (gameCopy.isStalemate()) reason = 'Stalemate';
          else if (gameCopy.isThreefoldRepetition()) reason = 'Threefold repetition';
          else if (gameCopy.isInsufficientMaterial()) reason = 'Insufficient material';
          online.broadcastGameOver('draw', reason);
        }

        // Update engine position for analysis
        sendCommand(`position fen ${newFen}`);
      }
    } catch (err) {
      console.warn('Failed to apply opponent move:', err);
    }
  }, [online, sendCommand]);

  useEffect(() => {
    online.onMoveReceived(applyOpponentMove);
  }, [online, applyOpponentMove]);

  // ─── Online: Reset board when game starts ───
  useEffect(() => {
    online.onGameStart(() => {
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

      // Set board orientation and user color to match assigned color
      if (online.playerColor) {
        setBoardOrientation(online.playerColor);
        setUserColor(online.playerColor);
      }

      setShowLobby(false);
      toast.success('🎮 Game started! You play as ' + (online.playerColor || 'white'));
      sendCommand('ucinewgame');
    });
  }, [online, sendCommand]);

  // Calculate evaluation bar height
  let whiteHeight = 50;
  if (stockfishEval.score !== null) {
    if (stockfishEval.type === 'mate') {
      whiteHeight = stockfishEval.score > 0 ? 100 : 0;
    } else {
      const scoreInPawns = stockfishEval.score / 100;
      // Clamp score between -10 and 10 for bar calculation
      const clampedScore = Math.max(-10, Math.min(10, scoreInPawns));
      whiteHeight = 50 + clampedScore * 5; // 5% per pawn advantage
    }
    if (boardOrientation === 'black') {
      whiteHeight = 100 - whiteHeight;
    }
  }

  const onDrop = ({ sourceSquare, targetSquare }) => {
    // ─── Online mode: only allow moves on your turn with your color ───
    if (isOnlineMode && online.gameStatus === 'playing') {
      const currentTurn = fen.split(' ')[1]; // 'w' or 'b'
      const myTurnChar = online.playerColor === 'white' ? 'w' : 'b';
      if (currentTurn !== myTurnChar) {
        toast.warning("It's not your turn!");
        return false;
      }
    }

    const gameCopy = new Chess(fen);
    const moveOptions = { from: sourceSquare, to: targetSquare };

    // Check for pawn promotion
    const piece = gameCopy.get(sourceSquare);
    if (piece && piece.type === 'p' &&
       ((piece.color === 'w' && targetSquare[1] === '8') ||
        (piece.color === 'b' && targetSquare[1] === '1'))) {
      moveOptions.promotion = 'q'; // Default to queen promotion
    }

    // Capture evaluation BEFORE the move for classification
    const turnBeforeMove = fen.split(' ')[1];
    const sideThatMoved = turnBeforeMove; // The side to move IS the one making the move
    evalBeforeRef.current = stockfishEval.score;
    pendingClassifyRef.current = true;
    pendingSideRef.current = sideThatMoved;
    pendingIsEngineRef.current = false;

    console.log('onDrop: Current FEN:', fen);
    console.log('onDrop: Move Options:', moveOptions);

    const move = gameCopy.move(moveOptions);

    if (move === null) {
      toast.error('Illegal move!');
      pendingClassifyRef.current = false;
      return false; // Illegal move
    }

    const newFen = gameCopy.fen();
    setFen(newFen);
    setLastMove({ from: move.from, to: move.to });
    setGame(gameCopy);
    
    // Update move history
    const newHistory = moveHistory.slice(0, historyPointer + 1);
    setMoveHistory([...newHistory, newFen]);
    
    // Update moves array
    const newMoves = moves.slice(0, historyPointer);
    if (move.san) newMoves.push(move.san);
    setMoves(newMoves);
    
    // Slice classifications to match pointer (remove stale ones from undo/redo)
    setMoveClassifications(prev => prev.slice(0, historyPointer));
    
    setHistoryPointer(newHistory.length);

    // Update engine
    sendCommand(`position fen ${newFen}`);

    // ─── Online mode: send move to opponent via Supabase ───
    if (isOnlineMode && online.gameStatus === 'playing') {
      online.sendMove({
        from: sourceSquare,
        to: targetSquare,
        promotion: moveOptions.promotion || null,
        san: move.san,
      });

      // Check for game-ending conditions after our move
      if (gameCopy.isCheckmate()) {
        const winner = gameCopy.turn() === 'w' ? 'black' : 'white';
        online.broadcastGameOver(winner, 'Checkmate!');
      } else if (gameCopy.isDraw()) {
        let reason = 'Draw';
        if (gameCopy.isStalemate()) reason = 'Stalemate';
        else if (gameCopy.isThreefoldRepetition()) reason = 'Threefold repetition';
        else if (gameCopy.isInsufficientMaterial()) reason = 'Insufficient material';
        online.broadcastGameOver('draw', reason);
      }
    }

    return true;
  };

  const undoMove = () => {
    if (historyPointer > 0) {
      // Also remove the last classification
      setMoveClassifications(prev => prev.slice(0, -1));
      
      const newPointer = historyPointer - 1;
      const newFen = moveHistory[newPointer];
      
      // Recreate game state from FEN without modifying moves array
      const newGame = new Chess(newFen);
      
      // Get the last move that was undone
      const lastMove = moves[newPointer];
      let lastMoveSquares = null;
      
      if (lastMove && newPointer < moveHistory.length - 1) {
        try {
          const tempGame = new Chess(moveHistory[newPointer]);
          const moveObj = tempGame.move(lastMove, { sloppy: true });
          if (moveObj) {
            lastMoveSquares = { from: moveObj.from, to: moveObj.to };
          }
        } catch (err) {
          console.error('Error getting last move squares:', err);
        }
      }

      setHistoryPointer(newPointer);
      setFen(newFen);
      setGame(newGame);
      setLastMove(lastMoveSquares);
      
      // Update engine
      sendCommand('ucinewgame');
      sendCommand(`position fen ${newFen}`);
    } else {
      toast.info('No moves to undo.');
    }
  };

  const redoMove = () => {
    if (historyPointer < moveHistory.length - 1) {
      // Classification for redone moves isn't available, add placeholder
      setMoveClassifications(prev => [...prev, LABELS.GOOD]);
      
      const newPointer = historyPointer + 1;
      const newFen = moveHistory[newPointer];
      
      // Recreate game state from FEN without modifying moves array
      const newGame = new Chess(newFen);
      
      // Get the last move that was redone
      const lastMove = moves[newPointer - 1];
      let lastMoveSquares = null;
      
      if (lastMove) {
        try {
          const tempGame = new Chess(moveHistory[newPointer - 1]);
          const moveObj = tempGame.move(lastMove, { sloppy: true });
          if (moveObj) {
            lastMoveSquares = { from: moveObj.from, to: moveObj.to };
          }
        } catch (err) {
          console.error('Error getting last move squares:', err);
        }
      }

      setHistoryPointer(newPointer);
      setFen(newFen);
      setGame(newGame);
      setLastMove(lastMoveSquares);
      
      // Update engine
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
      // Build PGN with headers
      const buildPGN = (headers, movesArray) => {
        const headerLines = Object.entries(headers).map(([k, v]) => `[${k} "${v}"]`).join('\n');
        const exportGame = new Chess();
        (movesArray || []).forEach(m => exportGame.move(m, { sloppy: true }));
        let movesStr = exportGame.pgn();
        // Remove any existing header block to avoid duplicating headers
        movesStr = movesStr.replace(/^(?:\[.*\]\s*)+/g, '').trim();
        return `${headerLines}\n\n${movesStr}`.trim();
      };

      const pgnStr = buildPGN(pgnHeaders, moves.length > 0 ? moves : game.history());
      setPgnInput(pgnStr);
    } catch (e) {
      console.error('PGN export error:', e);
      // Fallback: build PGN from current headers and game history to avoid duplicate headers
      try {
        const fallbackPGN = (() => {
          const headerLines = Object.entries(pgnHeaders).map(([k, v]) => `[${k} "${v}"]`).join('\n');
          const g = new Chess();
          (game.history() || []).forEach(m => g.move(m, { sloppy: true }));
          const movesOnly = g.pgn().replace(/^(?:\[.*\]\s*)+/g, '').trim();
          return `${headerLines}\n\n${movesOnly}`.trim();
        })();
        setPgnInput(fallbackPGN);
      } catch (e2) {
        // As a last resort, set raw game.pgn()
        setPgnInput(game.pgn());
      }
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
      // Build a friendly filename: YYYY-MM-DD_White_vs_Black.pgn
      const sanitize = (s) => {
        if (!s) return '';
        return s.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
      };

      // Use header Date if valid (not placeholder containing '?'), else use today's date
      let datePart = '';
      if (pgnHeaders.Date && !pgnHeaders.Date.includes('?')) {
        // Normalize separators to hyphen
        datePart = pgnHeaders.Date.replace(/\./g, '-').replace(/\//g, '-');
      } else {
        const d = new Date();
        datePart = d.toISOString().slice(0, 10); // YYYY-MM-DD
      }

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
      console.error('Download PGN error:', e);
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
      setMoveHistory([newFen]); // Reset history
      setHistoryPointer(0);   // Reset pointer
      setMoveClassifications([]);
      toast.success('FEN imported successfully!');
      setShowFenModal(false);
      sendCommand(`position fen ${newFen}`); // Sync engine
    } catch (error) {
      toast.error('Invalid FEN string.');
      console.error('FEN import error:', error);
    }
  };

  // Add handler to copy current FEN to clipboard (was missing)
  const handleCopyFen = () => {
    try {
      navigator.clipboard.writeText(fenInput || game.fen());
      toast.success('FEN copied to clipboard!');
      setShowFenModal(false);
    } catch (e) {
      console.error('Copy FEN failed:', e);
      toast.error('Failed to copy FEN');
    }
  };

  const handleImportPgn = () => {
    try {
      console.log("Attempting to import PGN:", pgnInput);
      const newGame = new Chess();
      newGame.loadPgn(pgnInput);
      const newFen = newGame.fen();
      setGame(newGame);
      setFen(newFen);

      // Extract SAN history and store in moves
      const pgnMoves = newGame.history();
      setMoves(pgnMoves);
      setLastMove(null);
      setStockfishEval({ score: null, type: 'cp' });

      // Build move history (FENs after each move)
      const history = newGame.history({ verbose: true });
      const newMoveHistory = [new Chess().fen()];
      const tempGame = new Chess();
      history.forEach(move => {
        tempGame.move(move);
        newMoveHistory.push(tempGame.fen());
      });
      setMoveHistory(newMoveHistory);
      setHistoryPointer(newMoveHistory.length - 1);

      // Parse PGN headers from pgnInput and update pgnHeaders state
      try {
        const headerRegex = /^\s*\[([^\s]+)\s+"([^"]*)"\]/gm;
        const parsedHeaders = { ...pgnHeaders };
        let m;
        const today = new Date().toISOString().slice(0,10).replace(/-/g, '.');
        while ((m = headerRegex.exec(pgnInput)) !== null) {
          const key = m[1];
          const val = m[2];
          if (key) parsedHeaders[key] = val || (key === 'Date' ? today : '?');
        }
        // Ensure Date is set to today's date if missing
        if (!parsedHeaders.Date || parsedHeaders.Date.includes('?')) parsedHeaders.Date = today;
        setPgnHeaders(parsedHeaders);
      } catch (hdrErr) {
        console.warn('Failed to parse PGN headers:', hdrErr);
      }

      toast.success('PGN imported successfully!');
      setShowPgnModal(false);
      sendCommand(`position fen ${newFen}`);
    } catch (error) {
      toast.error('Invalid PGN string.');
      console.error('PGN import error:', error);
    }
  };

  // ─── Online lobby handlers ───
  const handleOpenLobby = () => setShowLobby(true);
  const handleCloseLobby = () => {
    if (online.gameStatus === 'idle') {
      setShowLobby(false);
    }
  };
  const handleCreateGame = () => {
    online.createGame();
  };
  const handleJoinGame = (code) => {
    online.joinGame(code);
  };
  const handleResign = () => {
    online.resign();
  };
  const handleLeaveOnlineGame = () => {
    online.leaveGame();
    setShowLobby(false);
  };

  // Determine whose turn it is in online mode
  const currentTurn = fen.split(' ')[1]; // 'w' or 'b'
  const isMyTurn = online.playerColor
    ? (online.playerColor === 'white' ? currentTurn === 'w' : currentTurn === 'b')
    : false;

  if (isLoading) {
    // You can add a loading screen component here if you have one
    return <div>Loading...</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>ChessWeb</h1>
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
          {/* Online Status Bar */}
          <OnlineStatusBar
            playerColor={online.playerColor}
            isMyTurn={isMyTurn}
            opponentConnected={online.opponentConnected}
            onResign={handleResign}
            onLeaveGame={handleLeaveOnlineGame}
            gameStatus={online.gameStatus}
          />

          <Suspense fallback={<div className="chessboard-container-wrapper">Loading...</div>}>
            <ChessboardContainer
              fen={fen}
              onDrop={onDrop}
              boardOrientation={boardOrientation}
              lastMove={lastMove}
              isAutoMoveEnabled={isAutoMoveEnabled}
              makeAutoOpponentMove={makeAutoOpponentMove}
              userColor={userColor}
              isOnlineMode={isOnlineMode}
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
            isOnlineMode={isOnlineMode}
            onOpenLobby={handleOpenLobby}
          />
        </Suspense>

        <Suspense fallback={<div className="panel">Loading...</div>}>
          <MoveHistory
            moves={moves}
            classifications={moveClassifications}
          />
        </Suspense>
      </main>

      <ToastContainer 
        position="bottom-right" 
        autoClose={3000} 
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme="dark"
      />

      {/* Online Lobby Modal */}
      <OnlineLobby
        isOpen={showLobby}
        onClose={handleCloseLobby}
        gameStatus={online.gameStatus}
        gameCode={online.gameCode}
        playerColor={online.playerColor}
        opponentConnected={online.opponentConnected}
        gameResult={online.gameResult}
        error={online.error}
        onCreateGame={handleCreateGame}
        onJoinGame={handleJoinGame}
        onResign={handleResign}
        onLeaveGame={handleLeaveOnlineGame}
      />

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
        <div className="pgn-headers">
          <div className="pgn-header-row">
            <input value={pgnHeaders.Event} onChange={(e) => setPgnHeaders(h => ({...h, Event: e.target.value}))} placeholder="Event" />
            <input value={pgnHeaders.Site} onChange={(e) => setPgnHeaders(h => ({...h, Site: e.target.value}))} placeholder="Site" />
            <input value={pgnHeaders.Date} onChange={(e) => setPgnHeaders(h => ({...h, Date: e.target.value}))} placeholder="Date" />
          </div>
          <div className="pgn-header-row">
            <input value={pgnHeaders.Round} onChange={(e) => setPgnHeaders(h => ({...h, Round: e.target.value}))} placeholder="Round" />
            <input value={pgnHeaders.White} onChange={(e) => setPgnHeaders(h => ({...h, White: e.target.value}))} placeholder="White" />
            <input value={pgnHeaders.Black} onChange={(e) => setPgnHeaders(h => ({...h, Black: e.target.value}))} placeholder="Black" />
            <input value={pgnHeaders.Result} onChange={(e) => setPgnHeaders(h => ({...h, Result: e.target.value}))} placeholder="Result" />
          </div>
        </div>
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

export default App;