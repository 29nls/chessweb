import { Chess } from 'chess.js';
import { validateFen } from './validation';

export const initialOnlineState = (() => {
  const game = new Chess();
  const fen = game.fen();
  return {
    game,
    fen,
    lastMove: null,
    boardOrientation: 'white',
    moves: [],
    moveHistory: [fen],
    historyPointer: 0,
    showLobby: true,
    chatMessages: [],
  };
})();

export function onlineReducer(state, action) {
  switch (action.type) {
    case 'RESET_GAME': {
      const newGame = new Chess();
      const newFen = newGame.fen();
      return {
        ...state,
        game: newGame,
        fen: newFen,
        lastMove: null,
        moves: [],
        moveHistory: [newFen],
        historyPointer: 0,
        pendingTakeback: false,
        takebackRequestState: null,
      };
    }

    case 'SET_BOARD_ORIENTATION':
      return { ...state, boardOrientation: action.orientation };

    case 'SET_LOBBY_VISIBILITY':
      return { ...state, showLobby: action.visible };

    case 'RECORD_MOVE': {
      const { moveResult, newFen } = action.payload;
      const newHistory = state.moveHistory.slice(0, state.historyPointer + 1);
      const baseMoves = state.moves.slice(0, state.historyPointer);
      const newMoves = moveResult.san ? [...baseMoves, moveResult.san] : baseMoves;
      return {
        ...state,
        game: new Chess(newFen),
        fen: newFen,
        lastMove: { from: moveResult.from, to: moveResult.to },
        moves: newMoves,
        moveHistory: [...newHistory, newFen],
        historyPointer: newHistory.length,
      };
    }

    case 'SYNC_STATE': {
      const { fen, moves = [], moveHistory = [fen], orientation = 'white' } = action.payload;
      const validation = validateFen(fen);
      const safeFen = validation.valid ? validation.normalized : new Chess().fen();
      return {
        ...state,
        game: new Chess(safeFen),
        fen: safeFen,
        moves,
        moveHistory,
        historyPointer: moveHistory.length - 1,
        lastMove: null,
        showLobby: false,
        boardOrientation: orientation,
      };
    }

    case 'TAKEBACK_ACCEPTED': {
      const { movesToUndo } = action.payload;
      const newPointer = Math.max(0, state.historyPointer - movesToUndo);
      const newFen = state.moveHistory[newPointer];
      const newMoves = state.moves.slice(0, newPointer);
      let lastMove = null;
      if (newPointer > 0 && state.moves[newPointer - 1]) {
        try {
          const tempGame = new Chess(state.moveHistory[newPointer - 1]);
          const lastMoveObj = tempGame.move(state.moves[newPointer - 1], { sloppy: true });
          if (lastMoveObj) lastMove = { from: lastMoveObj.from, to: lastMoveObj.to };
        } catch (err) {
          // ignore reconstruction error
        }
      }
      return {
        ...state,
        game: new Chess(newFen),
        fen: newFen,
        moves: newMoves,
        moveHistory: state.moveHistory.slice(0, newPointer + 1),
        historyPointer: newPointer,
        lastMove,
        pendingTakeback: false,
        takebackRequestState: null,
      };
    }

    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatMessages: [...state.chatMessages, action.payload.message],
      };

    case 'REMOVE_CHAT_MESSAGE':
      return {
        ...state,
        chatMessages: state.chatMessages.filter((m) => m.id !== action.payload.id),
      };

    default:
      return state;
  }
}
