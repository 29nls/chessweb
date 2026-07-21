import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import { useOnlineGame } from '../hooks/useOnlineGame';
import OnlineLobby, { OnlineStatusBar } from '../OnlineLobby';
import { BoardSkeleton } from '../components/SkeletonLoader';
import { playMoveSound, findCheckedKingSquare, playSound } from '../lib/sound';
import { copyShareLink } from '../lib/share';
import { saveGame } from '../lib/gameHistory';

const ChessboardContainer = React.lazy(() => import('../ChessboardContainer'));

export default function OnlinePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = queryParams.get('tab') || 'play';

  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [lastMove, setLastMove] = useState(null);
  const [boardOrientation, setBoardOrientation] = useState('white');
  
  // We keep track of moves strictly for state syncing to spectators
  const [moves, setMoves] = useState([]);
  const [moveHistory, setMoveHistory] = useState([game.fen()]);
  const [historyPointer, setHistoryPointer] = useState(0);

  const [showLobby, setShowLobby] = useState(true);

  // Takeback & Draw modal states
  const [pendingTakeback, setPendingTakeback] = useState(false);
  const [pendingDraw, setPendingDraw] = useState(false);
  // 'sent' | 'received' | null – tracks whether WE sent the request
  const [takebackRequestState, setTakebackRequestState] = useState(null);
  const [drawRequestState, setDrawRequestState] = useState(null);

  // Chat & Reactions state
  const [chatMessages, setChatMessages] = useState([]);
  const chatIdCounter = useRef(0);

  const online = useOnlineGame();

  // ─── Clock management helpers ───
  const turnRef = useRef('w');
  const syncIntervalRef = useRef(null);

  // Store whiteTime/blackTime in refs so setInterval callback gets live values
  const whiteTimeRefForSync = useRef(0);
  const blackTimeRefForSync = useRef(0);
  useEffect(() => { whiteTimeRefForSync.current = online.whiteTime; }, [online.whiteTime]);
  useEffect(() => { blackTimeRefForSync.current = online.blackTime; }, [online.blackTime]);

  // Stop any existing sync interval
  const stopSyncInterval = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  // Start periodic clock sync broadcast (every 2s while clock is running)
  // sendClockSync reads from internal refs for live values when args are omitted
  const startSyncInterval = useCallback(() => {
    stopSyncInterval();
    syncIntervalRef.current = setInterval(() => {
      online.sendClockSync();  // No args => reads from whiteTimeRef/blackTimeRef internally
    }, 2000);
  }, [online, stopSyncInterval]);

  // Switch active clock after a move
  const switchClockAfterMove = useCallback((fromTurn) => {
    if (online.timeControlMs <= 0) return;
    const nextTurn = fromTurn === 'w' ? 'b' : 'w';
    turnRef.current = nextTurn;
    online.stopClock();
    const nextColor = nextTurn === 'w' ? 'white' : 'black';
    online.startClock(nextColor);
    startSyncInterval();
    // Broadcast clock state after switching — sendClockSync reads live refs
    setTimeout(() => {
      online.sendClockSync();
    }, 0);
  }, [online, startSyncInterval]);

  // ─── Online: Register move received callback ───
  const applyOpponentMove = useCallback((payload) => {
    const gameCopy = new Chess(fen);
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

        playMoveSound(moveResult, gameCopy);

        // Switch clock: stop opponent's, start mine
        switchClockAfterMove(gameCopy.turn() === 'w' ? 'b' : 'w');

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
      }
    } catch (err) {
      console.warn('Failed to apply opponent move:', err);
    }
  }, [fen, online, switchClockAfterMove]);

  useEffect(() => {
    online.onMoveReceived(applyOpponentMove);
  }, [online, applyOpponentMove]);

  // ─── Online: State Synchronization for Spectators ───
  const fenRef = useRef(fen);
  const movesRef = useRef(moves);
  const historyRef = useRef(moveHistory);
  const historyPointerRef = useRef(historyPointer);
  useEffect(() => { fenRef.current = fen; }, [fen]);
  useEffect(() => { movesRef.current = moves; }, [moves]);
  useEffect(() => { historyRef.current = moveHistory; }, [moveHistory]);
  useEffect(() => { historyPointerRef.current = historyPointer; }, [historyPointer]);

  useEffect(() => {
    online.onStateRequested((spectatorId) => {
      online.sendSyncState(spectatorId, fenRef.current, movesRef.current, historyRef.current);
    });

    online.onSyncStateReceived((syncedFen, syncedMoves, syncedHistory) => {
      const newGame = new Chess(syncedFen);
      setGame(newGame);
      setFen(syncedFen);
      setMoves(syncedMoves || []);
      setMoveHistory(syncedHistory || [syncedFen]);
      setHistoryPointer(syncedHistory ? syncedHistory.length - 1 : 0);
      setLastMove(null);
      setShowLobby(false);
      setBoardOrientation('white');
      toast.success('Joined as Spectator');
    });
  }, [online]);

  // ─── Online: Reset board when game starts ───
  useEffect(() => {
    online.onGameStart(() => {
      savedGameIdRef.current = null; // Reset for new game
      const newGame = new Chess();
      const initialFen = newGame.fen();
      setGame(newGame);
      setFen(initialFen);
      setMoves([]);
      setLastMove(null);
      setMoveHistory([initialFen]);
      setHistoryPointer(0);
      turnRef.current = 'w';

      // Reset takeback/draw state on new game
      setPendingTakeback(false);
      setPendingDraw(false);
      setTakebackRequestState(null);
      setDrawRequestState(null);

      // Set board orientation
      if (online.playerColor) {
        setBoardOrientation(online.playerColor);
      }

      // Initialize and start clock if time control is set
      if (online.timeControlMs > 0) {
        // White (host) already set the time control on createGame
        // Black receives via clock_sync from White
        if (online.playerColor === 'white') {
          online.startClock('white');
          startSyncInterval();
          online.sendClockSync(online.whiteTime, online.blackTime, 'white');
        }
      }

      setShowLobby(false);
      playSound('notify');
      toast.success('🎮 Game started! You play as ' + (online.playerColor || 'white'));
    });
  }, [online, startSyncInterval]);

  // ─── Online: Takeback lifecycle ───
  useEffect(() => {
    online.onTakebackRequested(() => {
      setPendingTakeback(true);
      setTakebackRequestState('received');
      setPendingDraw(false); // Cancel any pending draw modal
      playSound('notify');
    });

    online.onTakebackResponded((accepted) => {
      if (accepted) {
        // Use refs to avoid stale closure issues
        const curHistory = historyRef.current;
        const curMoves = movesRef.current;
        const curPointer = historyPointerRef.current;

        // Opponent accepted – undo last 2 half-moves (or 1 if only 1 move)
        const movesToUndo = Math.min(curHistory.length - 1, 2);
        if (movesToUndo > 0) {
          const newPointer = curPointer - movesToUndo;
          const newFen = curHistory[newPointer];
          const newGame = new Chess(newFen);
          const newMoves = curMoves.slice(0, newPointer);

          setFen(newFen);
          setGame(newGame);
          setMoves(newMoves);
          setMoveHistory(curHistory.slice(0, newPointer + 1));
          setHistoryPointer(newPointer);

          // Figure out last move squares
          if (newPointer > 0 && curMoves[newPointer - 1]) {
            try {
              const tempGame = new Chess(curHistory[newPointer - 1]);
              const lastMoveObj = tempGame.move(curMoves[newPointer - 1], { sloppy: true });
              if (lastMoveObj) setLastMove({ from: lastMoveObj.from, to: lastMoveObj.to });
              else setLastMove(null);
            } catch { setLastMove(null); }
          } else {
            setLastMove(null);
          }

          toast.success('Takeback accepted!', { autoClose: 2000 });
        }
      } else {
        toast.info('Opponent declined the takeback request.');
      }
      setPendingTakeback(false);
      setTakebackRequestState(null);
    });
  }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Online: Draw offer lifecycle ───
  useEffect(() => {
    online.onDrawOffered(() => {
      setPendingDraw(true);
      setDrawRequestState('received');
      setPendingTakeback(false); // Cancel any pending takeback modal
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

  // ─── Online: Chat & Reactions ───
  useEffect(() => {
    online.onChatMessage((text, senderColor, senderId) => {
      const isPlayerWhite = senderColor === 'white';
      const senderLabel = isPlayerWhite ? 'White' : 'Black';
      const id = ++chatIdCounter.current;
      setChatMessages(prev => [...prev, {
        id,
        type: 'text',
        text,
        sender: senderLabel,
        senderColor,
        isOwn: false,
      }]);
    });

    online.onReaction((emoji, senderColor, senderId) => {
      const isPlayerWhite = senderColor === 'white';
      const senderLabel = isPlayerWhite ? 'White' : 'Black';
      const id = ++chatIdCounter.current;
      setChatMessages(prev => [...prev, {
        id,
        type: 'reaction',
        text: emoji,
        sender: senderLabel,
        senderColor,
        isOwn: false,
      }]);
      // Hapus reaksi setelah 3 detik
      setTimeout(() => {
        setChatMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
      }, 3000);
    });
  }, [online]);

  // ─── Online: Clock Sync — correct drift when opponent sends sync ───
  useEffect(() => {
    online.onClockSync((wt, bt) => {
      // Update refs for continuous sync
      whiteTimeRefForSync.current = wt;
      blackTimeRefForSync.current = bt;
      // Correct drift if it exceeds 2 seconds (avoids jitter from minor divergence)
      if (Math.abs(wt - online.whiteTime) > 2000) {
        online.setClockTimesFromSync(wt, online.blackTime);
      }
      if (Math.abs(bt - online.blackTime) > 2000) {
        online.setClockTimesFromSync(online.whiteTime, bt);
      }
    });
  }, [online]);

  // ─── Online: Stop clock + save game on finish ───
  const savedGameIdRef = useRef(null);

  useEffect(() => {
    if (online.gameStatus === 'finished') {
      online.stopClock();
      stopSyncInterval();

      // Save the game to DB (only once)
      if (savedGameIdRef.current === null && movesRef.current.length > 0) {
        saveGame({
          pgn: (() => {
            try {
              const g = new Chess();
              movesRef.current.forEach(m => g.move(m, { sloppy: true }));
              return g.pgn();
            } catch { return ''; }
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

  // ─── Cleanup sync interval on unmount ───
  useEffect(() => {
    return () => stopSyncInterval();
  }, [stopSyncInterval]);

  const handleSendMessage = useCallback((text) => {
    const id = ++chatIdCounter.current;
    setChatMessages(prev => [...prev, {
      id,
      type: 'text',
      text,
      sender: 'You',
      senderColor: online.playerColor,
      isOwn: true,
    }]);
    online.sendChatMessage(text);
  }, [online]);

  const handleSendReaction = useCallback((emoji) => {
    const id = ++chatIdCounter.current;
    setChatMessages(prev => [...prev, {
      id,
      type: 'reaction',
      text: emoji,
      sender: 'You',
      senderColor: online.playerColor,
      isOwn: true,
    }]);
    online.sendReaction(emoji);
    // Hapus reaksi sendiri setelah 3 detik
    setTimeout(() => {
      setChatMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
    }, 3000);
  }, [online]);

  const onDrop = ({ sourceSquare, targetSquare }) => {
    if (online.gameStatus !== 'playing') return false;

    if (online.playerColor === 'spectator') {
      toast.warning("You are spectating!");
      return false;
    }
    
    const currentTurn = fen.split(' ')[1]; // 'w' or 'b'
    const myTurnChar = online.playerColor === 'white' ? 'w' : 'b';
    if (currentTurn !== myTurnChar) {
      toast.warning("It's not your turn!");
      return false;
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

    const move = gameCopy.move(moveOptions);
    if (move === null) {
      toast.error('Illegal move!');
      return false; 
    }

    playMoveSound(move, gameCopy);

    const newFen = gameCopy.fen();
    setFen(newFen);
    setLastMove({ from: move.from, to: move.to });
    setGame(gameCopy);
    
    const newHistory = moveHistory.slice(0, historyPointer + 1);
    setMoveHistory([...newHistory, newFen]);
    const newMoves = moves.slice(0, historyPointer);
    if (move.san) newMoves.push(move.san);
    setMoves(newMoves);
    setHistoryPointer(newHistory.length);

    online.sendMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: moveOptions.promotion || null,
      san: move.san,
    });

    // Switch clock: stop my clock, start opponent's
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
  };

  const handleCloseLobby = () => {
    if (online.gameStatus === 'idle') {
      navigate('/'); // Go back home if they close without joining
    } else {
      setShowLobby(false);
    }
  };

  const handleLeaveOnlineGame = () => {
    online.leaveGame();
    navigate('/');
  };

  const checkedKingSquare = findCheckedKingSquare(game);

  const currentTurn = fen.split(' ')[1];
  const isMyTurn = online.playerColor
    ? (online.playerColor === 'white' ? currentTurn === 'w' : currentTurn === 'b')
    : false;

  return (
    <div className="App">
      <main className="App-body online-mode">
        <div style={{ gridArea: 'chessboard' }}>
          <OnlineStatusBar
            playerColor={online.playerColor}
            isMyTurn={isMyTurn}
            opponentConnected={online.opponentConnected}
            onResign={online.resign}
            onLeaveGame={handleLeaveOnlineGame}
            gameStatus={online.gameStatus}
            movesCount={moves.length}
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
            // Takeback/Draw modal props
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
                    // Clock props
            whiteTime={online.whiteTime}
            blackTime={online.blackTime}
            timeControlMs={online.timeControlMs}
            // Chat props
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            onSendReaction={handleSendReaction}
          />
          <Suspense fallback={<BoardSkeleton />}>
            <ChessboardContainer
              fen={fen}
              onDrop={onDrop}
              boardOrientation={boardOrientation}
              lastMove={lastMove}
              isAutoMoveEnabled={false}
              makeAutoOpponentMove={() => {}}
              userColor={online.playerColor}
              isOnlineMode={true}
              isSpectator={online.playerColor === 'spectator'}
              checkedKingSquare={checkedKingSquare}
            />
          </Suspense>
        </div>
      </main>

      <OnlineLobby
        isOpen={showLobby}
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
          // Build PGN by replaying moves on a fresh Chess instance
          try {
            const g = new Chess();
            movesRef.current.forEach(m => g.move(m, { sloppy: true }));
            const pgn = g.pgn();
            const ok = await copyShareLink(pgn, online.gameResult);
            if (ok) toast.success('Replay link copied!');
            else toast.error('Failed to copy replay link');
          } catch {
            toast.error('Failed to generate replay link');
          }
        }}
      />
    </div>
  );
}
