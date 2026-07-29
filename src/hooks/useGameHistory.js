import { useState, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import { validateFen, validatePgn } from '../lib/validation';

/**
 * useGameHistory
 * Manages chess game state, FEN history, undo/redo, and move list.
 * Keeps AnalysisPage focused on UI rendering.
 */
export function useGameHistory() {
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(() => new Chess().fen());
  const [moveHistory, setMoveHistory] = useState(() => [new Chess().fen()]);
  const [moves, setMoves] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(0);
  const [lastMove, setLastMove] = useState(null);

  const applyMove = useCallback((gameCopy, moveResult, currentPointer, currentMoves) => {
    const newFen = gameCopy.fen();
    setFen(newFen);
    setGame(gameCopy);
    if (moveResult.san) {
      // Trim moves array seperti pushHistory trim moveHistory, untuk mencegah cabang stale
      const trimmedMoves = currentMoves.slice(0, currentPointer);
      setMoves([...trimmedMoves, moveResult.san]);
    }
    setLastMove({ from: moveResult.from, to: moveResult.to });
    return newFen;
  }, []);

  const pushHistory = useCallback((newFen, currentPointer, currentHistory) => {
    const newHistory = currentHistory.slice(0, currentPointer + 1);
    const updated = [...newHistory, newFen];
    setMoveHistory(updated);
    setHistoryPointer(newHistory.length);
    return newHistory.length; // new pointer value
  }, []);

  const setPositionOnEngine = useCallback((sendCommand, newFen) => {
    if (typeof sendCommand === 'function') {
      // useChessEngine.sendCommand already sends 'stop' before 'position',
      // so we only need to reset the engine state and set the new position.
      sendCommand('ucinewgame');
      sendCommand(`position fen ${newFen}`);
    }
  }, []);

  const undo = useCallback((currentPointer, currentHistory, currentMoves, sendCommand) => {
    if (currentPointer > 0) {
      const newPointer = currentPointer - 1;
      const newFen = currentHistory[newPointer];
      const newGame = new Chess(newFen);

      let lastMoveSquares = null;
      const lastMoveSan = currentMoves[newPointer];
      if (lastMoveSan && newPointer < currentHistory.length - 1) {
        try {
          const tempGame = new Chess(currentHistory[newPointer]);
          const moveObj = tempGame.move(lastMoveSan, { sloppy: true });
          if (moveObj) lastMoveSquares = { from: moveObj.from, to: moveObj.to };
        } catch (err) {
          console.warn('useGameHistory: Failed to reconstruct last move for undo:', err);
        }
      }

      setHistoryPointer(newPointer);
      setFen(newFen);
      setGame(newGame);
      setLastMove(lastMoveSquares);
      setPositionOnEngine(sendCommand, newFen);
      return newPointer;
    } else {
      toast.info('No moves to undo.');
      return currentPointer;
    }
  }, [setPositionOnEngine]);

  const redo = useCallback((currentPointer, currentHistory, currentMoves, sendCommand) => {
    if (currentPointer < currentHistory.length - 1) {
      const newPointer = currentPointer + 1;
      const newFen = currentHistory[newPointer];
      const newGame = new Chess(newFen);
      const lastMoveSan = currentMoves[newPointer - 1];

      let lastMoveSquares = null;
      if (lastMoveSan) {
        try {
          const tempGame = new Chess(currentHistory[newPointer - 1]);
          const moveObj = tempGame.move(lastMoveSan, { sloppy: true });
          if (moveObj) lastMoveSquares = { from: moveObj.from, to: moveObj.to };
        } catch (err) {
          console.warn('useGameHistory: Failed to reconstruct last move for redo:', err);
        }
      }

      setHistoryPointer(newPointer);
      setFen(newFen);
      setGame(newGame);
      setLastMove(lastMoveSquares);
      setPositionOnEngine(sendCommand, newFen);
      // Bugfix: jangan selalu return GOOD — biarkan engine generate ulang klasifikasi
      return { newPointer, addLabel: null };
    } else {
      toast.info('No moves to redo.');
      return { newPointer: currentPointer, addLabel: null };
    }
  }, [setPositionOnEngine]);

  /**
   * Apply a sequence of moves in batch — used for playing PV/engine lines.
   * The gameCopy should have ALL moves already applied to it.
   * moveResults is the array of move result objects from chess.js.
   * This batches all setState calls into one render cycle.
   */
  const applyMoveSequence = useCallback((gameCopy, moveResults, startPointer, currentMoves, currentHistory, sendCommand) => {
    if (!moveResults || moveResults.length === 0) return;

    const newFen = gameCopy.fen();
    const sanArray = moveResults.map(r => r.san).filter(Boolean);

    // Build final moves array by trimming and appending
    const trimmedMoves = currentMoves.slice(0, startPointer);
    const finalMoves = [...trimmedMoves, ...sanArray];

    // Build final history by replaying moves on a temp Chess instance
    const newHistory = currentHistory.slice(0, startPointer + 1);
    const tempGame = new Chess(currentHistory[startPointer]);
    for (const mr of moveResults) {
      tempGame.move(mr);
      newHistory.push(tempGame.fen());
    }

    // Reconstruct lastMove squares from the final move
    const lastMoveResult = moveResults[moveResults.length - 1];
    const lastMoveSquares = { from: lastMoveResult.from, to: lastMoveResult.to };

    // Batch all state updates at once
    setMoves(finalMoves);
    setMoveHistory(newHistory);
    setHistoryPointer(newHistory.length - 1);
    setFen(newFen);
    setGame(gameCopy);
    setLastMove(lastMoveSquares);

    setPositionOnEngine(sendCommand, newFen);
  }, [setPositionOnEngine]);

  const jumpToMove = useCallback((targetPointer, currentHistory, currentMoves, sendCommand) => {
    if (targetPointer < 0 || targetPointer >= currentHistory.length) return;
    const newFen = currentHistory[targetPointer];
    const newGame = new Chess(newFen);

    let lastMoveSquares = null;
    if (targetPointer > 0 && currentMoves[targetPointer - 1]) {
      try {
        const tempGame = new Chess(currentHistory[targetPointer - 1]);
        const moveObj = tempGame.move(currentMoves[targetPointer - 1], { sloppy: true });
        if (moveObj) lastMoveSquares = { from: moveObj.from, to: moveObj.to };
      } catch (err) {
        console.warn('useGameHistory: Failed to reconstruct last move for jump:', err);
      }
    }

    setHistoryPointer(targetPointer);
    setFen(newFen);
    setGame(newGame);
    setLastMove(lastMoveSquares);
    setPositionOnEngine(sendCommand, newFen);
  }, [setPositionOnEngine]);

  const reset = useCallback((sendCommand) => {
    const newGame = new Chess();
    const initialFen = newGame.fen();
    setGame(newGame);
    setFen(initialFen);
    setMoves([]);
    setLastMove(null);
    setMoveHistory([initialFen]);
    setHistoryPointer(0);
    toast.info('New game started.');
    if (typeof sendCommand === 'function') {
      setPositionOnEngine(sendCommand, initialFen);
    }
    return initialFen;
  }, [setPositionOnEngine]);

  const importFen = useCallback((fenStr, sendCommand) => {
    const validation = validateFen(fenStr);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid FEN');
      throw new Error(validation.error || 'Invalid FEN');
    }
    const newGame = new Chess(validation.normalized);
    const newFen = newGame.fen();
    setGame(newGame);
    setFen(newFen);
    setLastMove(null);
    setMoveHistory([newFen]);
    setHistoryPointer(0);
    setMoves([]);
    setPositionOnEngine(sendCommand, newFen);
    return newFen;
  }, [setPositionOnEngine]);

  const importPgn = useCallback((pgnStr, sendCommand) => {
    const validation = validatePgn(pgnStr);
    if (!validation.valid) {
      toast.error(validation.error || 'Invalid PGN');
      throw new Error(validation.error || 'Invalid PGN');
    }
    const newGame = new Chess();
    newGame.loadPgn(pgnStr);
    const newFen = newGame.fen();
    const pgnMoves = newGame.history();

    const history = newGame.history({ verbose: true });
    const newMoveHistory = [new Chess().fen()];
    const tempGame = new Chess();
    history.forEach((move) => {
      tempGame.move(move);
      newMoveHistory.push(tempGame.fen());
    });

    setGame(newGame);
    setFen(newFen);
    setMoves(pgnMoves);
    setLastMove(null);
    setMoveHistory(newMoveHistory);
    setHistoryPointer(newMoveHistory.length - 1);
    setPositionOnEngine(sendCommand, newFen);
    return newFen;
  }, [setPositionOnEngine]);

  // ═════════════════════════════════════════════════════════
  // CRITICAL: Memoized return object — keystone for re-render performance.
  // Without useMemo, AnalysisPage's handleBestMove / executeMove / playPvLine
  // (all useCallback with [history] deps) would be re-created on EVERY render,
  // cascading to every child component (Chessboard, Controls, MoveHistory, etc.).
  // ═════════════════════════════════════════════════════════
  return useMemo(() => ({
    game,
    fen,
    moveHistory,
    moves,
    historyPointer,
    lastMove,
    setMoves,
    applyMove,
    pushHistory,
    undo,
    redo,
    jumpToMove,
    applyMoveSequence,
    reset,
    importFen,
    importPgn,
    setPositionOnEngine,
  }), [
    game,
    fen,
    moveHistory,
    moves,
    historyPointer,
    lastMove,
    setMoves,
    applyMove,
    pushHistory,
    undo,
    redo,
    jumpToMove,
    applyMoveSequence,
    reset,
    importFen,
    importPgn,
    setPositionOnEngine,
  ]);
}
