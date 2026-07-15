import React, { useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';

const ChessboardContainer = ({
  fen,
  onDrop,
  boardOrientation,
  lastMove,
  isAutoMoveEnabled,
  makeAutoOpponentMove,
  userColor,
  isOnlineMode = false,
  isSpectator = false,
  checkedKingSquare = null,
}) => {
  const prevFenRef = useRef(fen);

  useEffect(() => {
    // Disable auto-move in online mode — opponent moves come via Supabase
    if (isOnlineMode) return;

    // Only run if the FEN has changed and auto-move is enabled.
    if (isAutoMoveEnabled && fen !== prevFenRef.current) {
      const turn = fen.split(' ')[1];
      const playerIsWhite = userColor === 'white'; // Use userColor to determine player's side
      const isOpponentTurn = (playerIsWhite && turn === 'b') || (!playerIsWhite && turn === 'w');

      if (isOpponentTurn) {
        // Delay the engine's move to feel more natural
        const timerId = setTimeout(() => {
          makeAutoOpponentMove(); // Changed from calculateNextMove
        }, 500);

        return () => clearTimeout(timerId);
      }
    }
    // Update the ref for the next render
    prevFenRef.current = fen;
  }, [fen, isAutoMoveEnabled, makeAutoOpponentMove, userColor, isOnlineMode]);

  return (
    <div className="chessboard-container-wrapper" data-testid="chessboard">
      <div className="chessboard-container">
        <Chessboard
          id="graphite-chessboard"
          options={{
            position: fen,
            onPieceDrop: onDrop,
            boardOrientation: boardOrientation,
            animationDurationInMs: 300,
            allowDragging: !isSpectator,
            allowDragOffBoard: false,
            darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
            lightSquareStyle: { backgroundColor: 'var(--board-light)' },
            boardStyle: {
              borderRadius: '6px',
              boxShadow: `0 5px 15px var(--shadow-color)`,
            },
            arrows: lastMove
              ? [{ startSquare: lastMove.from, endSquare: lastMove.to, color: 'var(--accent-primary)' }]
              : [],
            squareStyles: checkedKingSquare
              ? { [checkedKingSquare]: { backgroundColor: 'rgba(255, 0, 0, 0.4)' } }
              : {},
          }}
        />
      </div>
    </div>
  );
};

export default ChessboardContainer;
