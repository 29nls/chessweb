import { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';

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
        } catch (err) {}
      }

      setHistoryPointer(newPointer);
      setFen(newFen);
      setGame(newGame);
      setLastMove(lastMoveSquares);
      sendCommand('ucinewgame');
      sendCommand(`position fen ${newFen}`);
      return newPointer;
    } else {
      toast.info('No moves to undo.');
      return currentPointer;
    }
  }, []);

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
        } catch (err) {}
      }

      setHistoryPointer(newPointer);
      setFen(newFen);
      setGame(newGame);
      setLastMove(lastMoveSquares);
      sendCommand('ucinewgame');
      sendCommand(`position fen ${newFen}`);
      // Bugfix: jangan selalu return GOOD — biarkan engine generate ulang klasifikasi
      return { newPointer, addLabel: null };
    } else {
      toast.info('No moves to redo.');
      return { newPointer: currentPointer, addLabel: null };
    }
  }, []);

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
    sendCommand('ucinewgame');
    return initialFen;
  }, []);

  const importFen = useCallback((fenStr, sendCommand) => {
    const newGame = new Chess(fenStr);
    const newFen = newGame.fen();
    setGame(newGame);
    setFen(newFen);
    setLastMove(null);
    setMoveHistory([newFen]);
    setHistoryPointer(0);
    setMoves([]);
    sendCommand(`position fen ${newFen}`);
    return newFen;
  }, []);

  const importPgn = useCallback((pgnStr, sendCommand) => {
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
    sendCommand(`position fen ${newFen}`);
    return newFen;
  }, []);

  return {
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
    reset,
    importFen,
    importPgn,
  };
}
