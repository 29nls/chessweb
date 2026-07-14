import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Chess } from 'chess.js';
import { toast } from 'react-toastify';
import { useOnlineGame } from '../hooks/useOnlineGame';
import OnlineLobby, { OnlineStatusBar } from '../OnlineLobby';
import { BoardSkeleton } from '../components/SkeletonLoader';

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
  useEffect(() => {
    online.onStateRequested((spectatorId) => {
      online.sendSyncState(spectatorId, fen, moves, moveHistory);
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
  }, [online, fen, moves, moveHistory]);

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

      // Set board orientation
      if (online.playerColor) {
        setBoardOrientation(online.playerColor);
      }

      setShowLobby(false);
      toast.success('🎮 Game started! You play as ' + (online.playerColor || 'white'));
    });
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
