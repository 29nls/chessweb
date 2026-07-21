import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import { useOnlineGame } from '../hooks/useOnlineGame';
import OnlineLobby, { OnlineStatusBar } from '../OnlineLobby';
import { BoardSkeleton } from '../components/SkeletonLoader';
import { playMoveSound, findCheckedKingSquare, playSound } from '../lib/sound';

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

  const online = useOnlineGame();

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
  }, [fen, online]);

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
      const newGame = new Chess();
      const initialFen = newGame.fen();
      setGame(newGame);
      setFen(initialFen);
      setMoves([]);
      setLastMove(null);
      setMoveHistory([initialFen]);
      setHistoryPointer(0);

      // Reset takeback/draw state on new game
      setPendingTakeback(false);
      setPendingDraw(false);
      setTakebackRequestState(null);
      setDrawRequestState(null);

      // Set board orientation
      if (online.playerColor) {
        setBoardOrientation(online.playerColor);
      }

      setShowLobby(false);
      playSound('notify');
      toast.success('🎮 Game started! You play as ' + (online.playerColor || 'white'));
    });
  }, [online]);

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
      setChatMessages(prev => [...prev, {
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
      setChatMessages(prev => [...prev, {
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

  const handleSendMessage = useCallback((text) => {
    const isPlayerWhite = online.playerColor === 'white';
    const senderLabel = isPlayerWhite ? 'White' : 'Black';
    setChatMessages(prev => [...prev, {
      type: 'text',
      text,
      sender: 'You',
      senderColor: online.playerColor,
      isOwn: true,
    }]);
    online.sendChatMessage(text);
  }, [online]);

  const handleSendReaction = useCallback((emoji) => {
    const isPlayerWhite = online.playerColor === 'white';
    const senderLabel = isPlayerWhite ? 'White' : 'Black';
    setChatMessages(prev => [...prev, {
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
      />
    </div>
  );
}
