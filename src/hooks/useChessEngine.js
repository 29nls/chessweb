import { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { createEngine } from '../engine';
import { calculateLoss, classifyMove } from '../MoveClassification';

/**
 * useChessEngine
 * Manages Stockfish initialization, evaluation, and move classification.
 * Separated from UI concerns so AnalysisPage stays focused on rendering.
 */
export function useChessEngine({ threads, hashSize, fen, onBestMove }) {
  const [stockfishEval, setStockfishEval] = useState({ score: null, type: 'cp' });
  const [moveClassifications, setMoveClassifications] = useState([]);

  const engineMode = process.env.REACT_APP_ENGINE_MODE || 'browser';
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

  const engine = useRef(null);
  const analysisFenRef = useRef(null);
  const evalBeforeRef = useRef(null);
  const pendingClassifyRef = useRef(false);
  const pendingSideRef = useRef(null);
  const pendingIsEngineRef = useRef(false);
  const stockfishEvalRef = useRef(stockfishEval);
  const fenRef = useRef(fen);

  // Keep refs synced
  useEffect(() => {
    stockfishEvalRef.current = stockfishEval;
    fenRef.current = fen;
  }, [stockfishEval, fen]);

  const sendCommand = useCallback((command) => {
    if (engine.current) {
      engine.current.sendCommand(command);
    }
  }, []);

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
        evalBeforeRef.current = stockfishEvalRef.current.score;
        pendingClassifyRef.current = true;
        pendingSideRef.current = turn;
        pendingIsEngineRef.current = true;

        if (onBestMove) {
          const gameCopy = new Chess(fenRef.current);
          try {
            const moveResult = gameCopy.move(data.move, { sloppy: true });
            if (moveResult) {
              onBestMove(gameCopy, moveResult);
            }
          } catch (err) {
            // Ignore invalid moves
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineMode, backendUrl, threads, hashSize, sendCommand]);

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
    stockfishEval,
    moveClassifications,
    sendCommand,
    analysisFenRef,
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
