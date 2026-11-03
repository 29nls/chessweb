import React, { Suspense, useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import { useOnlineGame } from '../hooks/useOnlineGame';
import { useLoadingSequence } from '../hooks/useLoadingSequence';
import OnlineLobby, { OnlineStatusBar } from '../OnlineLobby';
import { BoardSkeleton, OnlineSkeleton } from '../components/SkeletonLoader';
import ErrorBoundary from '../ErrorBoundary';
import { playMoveSound, findCheckedKingSquare, playSound } from '../lib/sound';
import { copyShareLink } from '../lib/share';
import { saveGame } from '../lib/gameHistory';
import { onlineReducer, initialOnlineState } from '../lib/onlinePageReducer';
import { classifyIncomingMove, nextMoveSequence, MOVE_SEQUENCE_RESULT } from '../lib/moveSequence';

const ChessboardContainer = React.lazy(() => import('../ChessboardContainer'));

export default function OnlinePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') || 'play';

  const [state, dispatch] = useReducer(onlineReducer, initialOnlineState);

  const { isLoading, showSkeleton, stepIndex } = useLoadingSequence({
    minLoadingMs: 200,
    stepCount: 4,
    stepTotalMs: 800,
  });

  const online = useOnlineGame();

  // Refs to latest state values for closures and external callbacks
  const fenRef = useRef(state.fen);
  const movesRef = useRef(state.moves);
  const moveHistoryRef = useRef(state.moveHistory);
  const historyPointerRef = useRef(state.historyPointer);
  useEffect(() => { fenRef.current = state.fen; }, [state.fen]);
  useEffect(() => { movesRef.current = state.moves; }, [state.moves]);
  useEffect(() => { moveHistoryRef.current = state.moveHistory; }, [state.moveHistory]);
  useEffect(() => { historyPointerRef.current = state.historyPointer; }, [state.historyPointer]);

  // ─── Clock management helpers ───
  const turnRef = useRef('w');
  const syncIntervalRef = useRef(null);

  const whiteTimeRefForSync = useRef(0);
  const blackTimeRefForSync = useRef(0);
  useEffect(() => { whiteTimeRefForSync.current = online.whiteTime; }, [online.whiteTime]);
  useEffect(() => { blackTimeRefForSync.current = online.blackTime; }, [online.blackTime]);

  const stopSyncInterval = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  const startSyncInterval = useCallback(() => {
    stopSyncInterval();
    syncIntervalRef.current = setInterval(() => {
      online.sendClockSync();
    }, 2000);
  }, [online, stopSyncInterval]);

  const switchClockAfterMove = useCallback((fromTurn) => {
    if (online.timeControlMs <= 0) return;
    const nextTurn = fromTurn === 'w' ? 'b' : 'w';
    turnRef.current = nextTurn;
    online.stopClock();
    const nextColor = nextTurn === 'w' ? 'white' : 'black';
    online.startClock(nextColor);
    startSyncInterval();
    setTimeout(() => {
      online.sendClockSync();
    }, 0);
  }, [online, startSyncInterval]);

  // ─── Online: Register move received callback ───

  const applyOpponentMove = useCallback((payload) => {
    const { sequence, from, to, promotion, san, moveId } = payload || {};

    // Expected sequence is derived from the moves actually applied, not from a
    // one-way watermark: a delayed-but-valid move must still be applied.
    // state.moves and state.fen are updated by the same reducer action, so they
    // can never disagree (unlike a ref that trails the last render).
    const verdict = classifyIncomingMove({ sequence, appliedCount: state.moves.length });

    if (verdict === MOVE_SEQUENCE_RESULT.DUPLICATE) {
      // Already applied (duplicate delivery) — ignore.
      return;
    }

    if (verdict === MOVE_SEQUENCE_RESULT.GAP) {
      // We missed at least one move. Supabase broadcast is at-most-once, so
      // this cannot be recovered locally: ask the opponent for the real state
      // instead of guessing and drifting further out of sync.
      console.warn('applyOpponentMove: sequence gap, requesting resync', {
        appliedCount: state.moves.length, received: sequence, moveId,
      });
      if (online.requestSyncState) online.requestSyncState();
      return;
    }

    // Validate against the current position before mutating anything.
    try {
      const probe = new Chess(state.fen);
      const legal = probe.moves({ square: from, verbose: true });
      if (!legal.some(m => m.from === from && m.to === to)) {
        // Stale board or invalid move: recover from the opponent rather than
        // applying a move to the wrong position.
        console.warn('applyOpponentMove: move not legal here, requesting resync', {
          from, to, fen: state.fen, san, moveId, sequence,
        });
        if (online.requestSyncState) online.requestSyncState();
        return;
      }
    } catch (err) {
      console.warn('applyOpponentMove: invalid position, requesting resync', err);
      if (online.requestSyncState) online.requestSyncState();
      return;
    }

    try {
      const gameCopy = new Chess(state.fen);
      const moveOptions = { from, to };
      if (promotion) moveOptions.promotion = promotion;
      const moveResult = gameCopy.move(moveOptions);
      if (!moveResult) return;

      dispatch({
        type: 'RECORD_MOVE',
        payload: { moveResult, newFen: gameCopy.fen() },
      });

      playMoveSound(moveResult, gameCopy);
      switchClockAfterMove(gameCopy.turn() === 'w' ? 'b' : 'w');

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
    } catch (err) {
      console.warn('Failed to apply opponent move:', err);
    }
  }, [state.fen, state.moves.length, online, switchClockAfterMove]);

  useEffect(() => {
    online.onMoveReceived(applyOpponentMove);
  }, [online, applyOpponentMove]);

  // ─── Online: State Synchronization for Spectators ───
  useEffect(() => {
    online.onStateRequested((spectatorId) => {
      online.sendSyncState(spectatorId, fenRef.current, movesRef.current, moveHistoryRef.current);
    });

    online.onSyncStateReceived((syncedFen, syncedMoves, syncedHistory) => {
      const isSpectator = online.playerColor === 'spectator';
      // Players keep their own board orientation; only spectators default to white.
      const orientation = isSpectator ? 'white' : (online.playerColor || 'white');
      dispatch({
        type: 'SYNC_STATE',
        payload: { fen: syncedFen, moves: syncedMoves, moveHistory: syncedHistory, orientation },
      });
      if (isSpectator) toast.success('Joined as Spectator');
    });
  }, [online]);

  // ─── Online: Reset board when game starts ───
  useEffect(() => {
    online.onGameStart(() => {
      savedGameIdRef.current = null;
      dispatch({ type: 'RESET_GAME' });
      turnRef.current = 'w';

      setPendingTakeback(false);
      setPendingDraw(false);
      setTakebackRequestState(null);
      setDrawRequestState(null);

      if (online.playerColor) {
        dispatch({ type: 'SET_BOARD_ORIENTATION', orientation: online.playerColor });
      }

      if (online.timeControlMs > 0 && online.playerColor === 'white') {
        online.startClock('white');
        startSyncInterval();
        online.sendClockSync(online.whiteTime, online.blackTime, 'white');
      }

      dispatch({ type: 'SET_LOBBY_VISIBILITY', visible: false });
      playSound('notify');
      toast.success(' Game started! You play as ' + (online.playerColor || 'white'));
    });
  }, [online, startSyncInterval]);

  // ─── Online: Takeback lifecycle ───
  useEffect(() => {
    online.onTakebackRequested(() => {
      setPendingTakeback(true);
      setTakebackRequestState('received');
      setPendingDraw(false);
      playSound('notify');
    });

    online.onTakebackResponded((accepted) => {
      if (accepted) {
        const movesToUndo = Math.min(moveHistoryRef.current.length - 1, 2);
        if (movesToUndo > 0) {
          dispatch({ type: 'TAKEBACK_ACCEPTED', payload: { movesToUndo } });
          toast.success('Takeback accepted!', { autoClose: 2000 });
        }
      } else {
        toast.info('Opponent declined the takeback request.');
      }
      setPendingTakeback(false);
      setTakebackRequestState(null);
    });
  }, [online]);

  // ─── Online: Draw offer lifecycle ───
  useEffect(() => {
    online.onDrawOffered(() => {
      setPendingDraw(true);
      setDrawRequestState('received');
      setPendingTakeback(false);
      playSound('notify');
    });

    online.onDrawResponded((accepted) => {
      if (accepted) {
        toast.success('🤝 Draw accepted!', { autoClose: 3000 });
      } else {
        toast.info('Opponent declined the draw offer.');
      }
      setPendingDraw(false);
      setDrawRequestState(null);
    });
  }, [online]);

  // ─── Chat & Reactions ───
  const chatIdCounter = useRef(0);

  useEffect(() => {
    online.onChatMessage((text, senderColor, senderId) => {
      const isPlayerWhite = senderColor === 'white';
      const senderLabel = isPlayerWhite ? 'White' : 'Black';
      const id = ++chatIdCounter.current;
      dispatch({
        type: 'ADD_CHAT_MESSAGE',
        payload: {
          message: {
            id,
            type: 'text',
            text,
            sender: senderLabel,
            senderColor,
            isOwn: false,
          },
        },
      });
    });

    online.onReaction((emoji, senderColor, senderId) => {
      const isPlayerWhite = senderColor === 'white';
      const senderLabel = isPlayerWhite ? 'White' : 'Black';
      const id = ++chatIdCounter.current;
      dispatch({
        type: 'ADD_CHAT_MESSAGE',
        payload: {
          message: {
            id,
            type: 'reaction',
            text: emoji,
            sender: senderLabel,
            senderColor,
            isOwn: false,
          },
        },
      });
      setTimeout(() => {
        dispatch({ type: 'REMOVE_CHAT_MESSAGE', payload: { id } });
      }, 3000);
    });
  }, [online]);

  // ─── Clock Sync ───
  const whiteTimeRef = useRef(online.whiteTime);
  const blackTimeRef = useRef(online.blackTime);
  useEffect(() => { whiteTimeRef.current = online.whiteTime; }, [online.whiteTime]);
  useEffect(() => { blackTimeRef.current = online.blackTime; }, [online.blackTime]);

  useEffect(() => {
    online.onClockSync((wt, bt) => {
      whiteTimeRefForSync.current = wt;
      blackTimeRefForSync.current = bt;
      const currentWt = whiteTimeRef.current;
      const currentBt = blackTimeRef.current;
      if (Math.abs(wt - currentWt) > 2000) {
        online.setClockTimesFromSync(wt, currentBt);
      }
      if (Math.abs(bt - currentBt) > 2000) {
        online.setClockTimesFromSync(currentWt, bt);
      }
    });
  }, [online]);

  // ─── Stop clock + save game on finish ───
  const savedGameIdRef = useRef(null);

  useEffect(() => {
    if (online.gameStatus === 'finished') {
      online.stopClock();
      stopSyncInterval();

      if (savedGameIdRef.current === null && movesRef.current.length > 0) {
        saveGame({
          pgn: (() => {
            try {
              const g = new Chess();
              movesRef.current.forEach(m => g.move(m, { sloppy: true }));
              return g.pgn();
            } catch (err) { console.warn('Failed to build PGN from moves for save:', err); return ''; }
          })(),
          result: online.gameResult,
          moves: movesRef.current,
          fen: fenRef.current,
          source: 'online',
          gameCode: online.gameCode,
          playerWhite: 'Player 1',
          playerBlack: 'Player 2',
          timeControlMs: online.timeControlMs,
        }).then(saved => {
          if (saved) savedGameIdRef.current = saved.id;
        });
      }
    }
  }, [online.gameStatus, online, stopSyncInterval]);

  useEffect(() => {
    return () => stopSyncInterval();
  }, [stopSyncInterval]);

  // Keep local modal state separate from game state reducer
  const [pendingTakeback, setPendingTakeback] = useState(false);
  const [pendingDraw, setPendingDraw] = useState(false);
  const [takebackRequestState, setTakebackRequestState] = useState(null);
  const [drawRequestState, setDrawRequestState] = useState(null);

  const handleSendMessage = useCallback((text) => {
    const id = ++chatIdCounter.current;
    dispatch({
      type: 'ADD_CHAT_MESSAGE',
      payload: {
        message: {
          id,
          type: 'text',
          text,
          sender: 'You',
          senderColor: online.playerColor,
          isOwn: true,
        },
      },
    });
    online.sendChatMessage(text);
  }, [online]);

  const handleSendReaction = useCallback((emoji) => {
    const id = ++chatIdCounter.current;
    dispatch({
      type: 'ADD_CHAT_MESSAGE',
      payload: {
        message: {
          id,
          type: 'reaction',
          text: emoji,
          sender: 'You',
          senderColor: online.playerColor,
          isOwn: true,
        },
      },
    });
    online.sendReaction(emoji);
    setTimeout(() => {
      dispatch({ type: 'REMOVE_CHAT_MESSAGE', payload: { id } });
    }, 3000);
  }, [online]);

  const onDrop = useCallback(({ sourceSquare, targetSquare }) => {
    if (online.gameStatus !== 'playing') return false;

    if (online.playerColor === 'spectator') {
      toast.warning('You are spectating!');
      return false;
    }

    const currentTurn = state.fen.split(' ')[1];
    const myTurnChar = online.playerColor === 'white' ? 'w' : 'b';
    if (currentTurn !== myTurnChar) {
      toast.warning("It's not your turn!");
      return false;
    }

    const gameCopy = new Chess(state.fen);
    const moveOptions = { from: sourceSquare, to: targetSquare };

    const piece = gameCopy.get(sourceSquare);
    if (piece && piece.type === 'p' &&
       ((piece.color === 'w' && targetSquare[1] === '8') ||
        (piece.color === 'b' && targetSquare[1] === '1'))) {
      moveOptions.promotion = 'q';
    }

    const move = gameCopy.move(moveOptions);
    if (move === null) {
      toast.error('Illegal move!');
      return false;
    }

    playMoveSound(move, gameCopy);

    const newFen = gameCopy.fen();
    dispatch({
      type: 'RECORD_MOVE',
      payload: { moveResult: move, newFen },
    });

    // Tag the move with its 1-based sequence number so the opponent can detect
    // duplicates and gaps. state.moves.length is pre-dispatch here, so the next
    // sequence is exactly this move's position in the game.
    online.sendMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: moveOptions.promotion || null,
      san: move.san,
    }, nextMoveSequence(state.moves.length));

    switchClockAfterMove(gameCopy.turn() === 'w' ? 'b' : 'w');

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

    return true;
  }, [state.fen, state.moves.length, online, switchClockAfterMove]);

  const handleLeaveOnlineGame = () => {
    online.leaveGame();
    navigate('/');
  };

  const handleCloseLobby = () => {
    if (online.gameStatus === 'idle') {
      navigate('/');
    } else {
      dispatch({ type: 'SET_LOBBY_VISIBILITY', visible: false });
    }
  };
  const checkedKingSquare = findCheckedKingSquare(state.game);

  const currentTurn = state.fen.split(' ')[1];
  const isMyTurn = online.playerColor
    ? (online.playerColor === 'white' ? currentTurn === 'w' : currentTurn === 'b')
    : false;

  return (
    <div className="sk-transition-wrap">
      {showSkeleton && (
        <div className={`sk-fade-layer ${!isLoading ? 'sk-fade-out' : ''}`}>
          <OnlineSkeleton stepIndex={stepIndex} />
        </div>
      )}
      <div className={`sk-entering-content ${!isLoading ? 'sk-crossfade' : ''}`}>
        <div className="App">
          <main className="App-body online-mode">
            <div className="online-column">
              <OnlineStatusBar
                playerColor={online.playerColor}
                isMyTurn={isMyTurn}
                opponentConnected={online.opponentConnected}
                onResign={online.resign}
                onLeaveGame={handleLeaveOnlineGame}
                gameStatus={online.gameStatus}
                movesCount={state.moves.length}
                spectatorCount={online.spectatorCount}
                connectionQuality={online.opponentConnected ? 'connected' : 'disconnected'}
                onRequestTakeback={() => {
                  online.sendTakebackRequest();
                  setTakebackRequestState('sent');
                  toast.info('Takeback request sent to opponent.');
                }}
                onOfferDraw={() => {
                  online.offerDraw();
                  setDrawRequestState('sent');
                  toast.info('Draw offer sent to opponent.');
                }}
                pendingTakeback={pendingTakeback}
                takebackRequestState={takebackRequestState}
                onAcceptTakeback={() => {
                  online.sendTakebackResponse(true);
                  setPendingTakeback(false);
                  setTakebackRequestState(null);
                }}
                onDeclineTakeback={() => {
                  online.sendTakebackResponse(false);
                  setPendingTakeback(false);
                  setTakebackRequestState(null);
                }}
                pendingDraw={pendingDraw}
                drawRequestState={drawRequestState}
                onAcceptDraw={() => {
                  online.sendDrawResponse(true);
                  setPendingDraw(false);
                  setDrawRequestState(null);
                }}
                onDeclineDraw={() => {
                  online.sendDrawResponse(false);
                  setPendingDraw(false);
                  setDrawRequestState(null);
                }}
                whiteTime={online.whiteTime}
                blackTime={online.blackTime}
                timeControlMs={online.timeControlMs}
                messages={state.chatMessages}
                onSendMessage={handleSendMessage}
                onSendReaction={handleSendReaction}
              />
              <Suspense fallback={<BoardSkeleton />}>
                <ErrorBoundary componentName="Online Chessboard">
                  <ChessboardContainer
                    fen={state.fen}
                    onDrop={onDrop}
                    boardOrientation={state.boardOrientation}
                    lastMove={state.lastMove}
                    isAutoMoveEnabled={false}
                    makeAutoOpponentMove={() => {}}
                    userColor={online.playerColor}
                    isOnlineMode={true}
                    isSpectator={online.playerColor === 'spectator'}
                    checkedKingSquare={checkedKingSquare}
                  />
                </ErrorBoundary>
              </Suspense>
            </div>
          </main>

          <OnlineLobby
            isOpen={state.showLobby}
            initialTab={initialTab}
            onClose={handleCloseLobby}
            gameStatus={online.gameStatus}
            gameCode={online.gameCode}
            playerColor={online.playerColor}
            opponentConnected={online.opponentConnected}
            gameResult={online.gameResult}
            error={online.error}
            onCreateGame={online.createGame}
            onJoinGame={online.joinGame}
            onJoinSpectator={online.joinAsSpectator}
            onResign={online.resign}
            onLeaveGame={handleLeaveOnlineGame}
            onShareReplay={async () => {
              try {
                const g = new Chess();
                movesRef.current.forEach(m => g.move(m, { sloppy: true }));
                const pgn = g.pgn();
                const ok = await copyShareLink(pgn, online.gameResult);
                if (ok) toast.success('Replay link copied!');
                else toast.error('Failed to copy replay link');
              } catch (err) {
                console.error('Failed to generate replay link:', err);
                toast.error('Failed to generate replay link');
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
