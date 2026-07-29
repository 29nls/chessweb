import { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { createEngine } from '../engine';
import { isGoCommand } from '../engine/uciUtil';
import { calculateLoss, classifyMove } from '../MoveClassification';

export function normalizeEvaluationToWhite(score, turn) {
  return turn === 'b' ? { ...score, value: -score.value } : score;
}

/**
 * useChessEngine
 * Manages Stockfish initialization, evaluation, and move classification.
 * Separated from UI concerns so AnalysisPage stays focused on rendering.
 */
export function useChessEngine({ threads, hashSize, fen, onBestMove, multiPv = 1 }) {
  const [engineReady, setEngineReady] = useState(false);
  const [stockfishEval, setStockfishEval] = useState({ score: null, type: 'cp' });
  const [moveClassifications, setMoveClassifications] = useState([]);
  const [multiPvLines, setMultiPvLines] = useState([]);

  const engineMode = process.env.REACT_APP_ENGINE_MODE || 'browser';
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

  const engine = useRef(null);
  const evalBeforeRef = useRef(null);
  const pendingClassifyRef = useRef(false);
  const pendingSideRef = useRef(null);
  const pendingIsEngineRef = useRef(false);
  const stockfishEvalRef = useRef(stockfishEval);
  const fenRef = useRef(fen);
  const multiPvRef = useRef(multiPv);
  const onBestMoveRef = useRef(onBestMove);

  // ── Search request tracking ───────────────────────────────
  // The engine tags every info/bestmove with a searchId. We keep the
  // current search ID here so stale output from a superseded search is
  // ignored before it can update React state, classification, or
  // onBestMove callbacks.
  const currentSearchIdRef = useRef(null);

  // Keep refs synced
  useEffect(() => {
    stockfishEvalRef.current = stockfishEval;
    fenRef.current = fen;
    multiPvRef.current = multiPv;
  }, [stockfishEval, fen, multiPv]);

  // Keep onBestMove ref synced so the engine closure always reads the latest callback
  useEffect(() => {
    onBestMoveRef.current = onBestMove;
  }, [onBestMove]);

  // Use refs for engine settings so changing them doesn't recreate the engine
  const threadsRef = useRef(threads);
  const hashSizeRef = useRef(hashSize);
  const multiPvRefForConnect = useRef(multiPv);

  const sendCommand = useCallback((command) => {
    let searchId;
    if (engine.current) {
      searchId = engine.current.sendCommand(command);
    }

    if (typeof command === 'string' && isGoCommand(command)) {
      // Start a new search. Store the engine-assigned searchId so only
      // output belonging to this search is accepted.
      currentSearchIdRef.current = searchId;

      // Reset UI state for the new position so the user doesn't see
      // leftover eval/multi-PV from a previous search. Intentionally done
      // even for classification searches to keep the UI coherent.
      setStockfishEval({ score: null, type: 'cp' });
      setMultiPvLines([]);

      // Classification is gated by isCurrentSearch in the output handler,
      // so it automatically applies to the first info of this new search.
    }

    // Reset pending classification when starting a new game or stopping
    if (command === 'ucinewgame') {
      // New game resets everything; clear the current search so stale
      // output from a previous game cannot affect the new one.
      currentSearchIdRef.current = null;
      pendingClassifyRef.current = false;
    }
    if (command === 'stop') {
      pendingClassifyRef.current = false;
    }
  }, []);

  useEffect(() => {
    threadsRef.current = threads;
    hashSizeRef.current = hashSize;
    multiPvRefForConnect.current = multiPv;
  }, [threads, hashSize, multiPv]);

  // Separate effect: send setoption when settings change, no engine recreation
  useEffect(() => {
    if (engine.current) {
      sendCommand(`setoption name Threads value ${threads}`);
      sendCommand(`setoption name Hash value ${hashSize}`);
      sendCommand(`setoption name MultiPV value ${multiPv}`);
    }
  }, [threads, hashSize, multiPv, sendCommand]);

  useEffect(() => {
    engine.current = createEngine(engineMode, backendUrl);

    const cleanupOutput = engine.current.onOutput((data) => {
      // Only accept output belonging to the current search. Output without
      // a searchId is treated as current for backward compatibility.
      const isCurrentSearch =
        data.searchId == null || data.searchId === currentSearchIdRef.current;

      if (data.type === 'info' && data.score) {
        if (!isCurrentSearch) return;

        const idx = (data.multipv || 1) - 1;
        const normalizedScore = normalizeEvaluationToWhite(data.score, fenRef.current.split(' ')[1]);
        const lineEval = {
          score: normalizedScore.value,
          type: data.score.type,
          depth: data.depth,
          pv: data.pv || [],
          nodes: data.nodes,
          nps: data.nps,
          tbhits: data.tbhits,
        };

        if (idx === 0) {
          setStockfishEval(lineEval);
        }

        setMultiPvLines((prev) => {
          const updated = [...prev];
          updated[idx] = lineEval;
          return updated;
        });

        if (pendingClassifyRef.current && isCurrentSearch) {
          let beforeScore = evalBeforeRef.current;
          let afterScore = data.score.value;

          // Normalisasi afterScore ke perspektif Putih (sama seperti lineEval.score)
          // Normalisasi: new position punya turn = !sideThatMoved
          // Kalau sideThatMoved = 'w', new position punya black's turn → Stockfish score dari perspektif hitam → negate
          const evalTurn = pendingSideRef.current;
          if (evalTurn === 'w') {
            afterScore = -afterScore;
          }

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
        if (!isCurrentSearch) return;

        setMultiPvLines([]);
        const turn = fenRef.current.split(' ')[1];
        evalBeforeRef.current = stockfishEvalRef.current.score;
        pendingClassifyRef.current = true;
        pendingSideRef.current = turn;
        pendingIsEngineRef.current = true;

        const bestMoveCb = onBestMoveRef.current;
        if (bestMoveCb) {
          const gameCopy = new Chess(fenRef.current);
          try {
            const moveResult = gameCopy.move(data.move, { sloppy: true });
            if (moveResult) {
              bestMoveCb(gameCopy, moveResult);
            }
          } catch (err) {
            // Ignore invalid moves
          }
        }
      }
    });

    engine.current.onConnect(() => {
      setEngineReady(true);
      sendCommand('uci');
      sendCommand(`setoption name Threads value ${threadsRef.current}`);
      sendCommand(`setoption name Hash value ${hashSizeRef.current}`);
      sendCommand(`setoption name MultiPV value ${multiPvRefForConnect.current}`);
      sendCommand('isready');
    });

    return () => {
      cleanupOutput();
      engine.current.disconnect();
      currentSearchIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineMode, backendUrl, sendCommand]);

  const prepareClassification = useCallback((side) => {
    evalBeforeRef.current = stockfishEvalRef.current.score;
    pendingClassifyRef.current = true;
    pendingSideRef.current = side;
    pendingIsEngineRef.current = false;
  }, []);

  const cancelClassification = useCallback(() => {
    pendingClassifyRef.current = false;
  }, []);

  const resetEval = useCallback(() => {
    setStockfishEval({ score: null, type: 'cp' });
  }, []);

  const resetClassifications = useCallback(() => {
    setMoveClassifications([]);
  }, []);

  const sliceClassifications = useCallback((end) => {
    setMoveClassifications((prev) => prev.slice(0, end));
  }, []);

  const addClassification = useCallback((label) => {
    setMoveClassifications((prev) => [...prev, label]);
  }, []);

  return {
    engineReady,
    stockfishEval,
    moveClassifications,
    multiPvLines,
    sendCommand,
    prepareClassification,
    cancelClassification,
    resetEval,
    resetClassifications,
    sliceClassifications,
    addClassification,
    engineMode,
    backendUrl,
  };
}
