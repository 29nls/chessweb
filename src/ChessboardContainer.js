import React, { useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';

const ChessboardContainer = ({
  fen,
  onDrop,
  boardOrientation,
  lastMove,
  isAutoMoveEnabled,
  makeAutoOpponentMove,
  userColor, // New prop for user's playing color
  tablebaseData // New prop for tablebase data (for move highlighting)
}) => {
  const prevFenRef = useRef(fen);

  // Calculate tablebase move arrows (W/D/L highlighting)
  const calculateTablebaseArrows = () => {
    if (!tablebaseData || !tablebaseData.moves) {
      return [];
    }

    const arrows = [];

    tablebaseData.moves.forEach((move) => {
      if (!move.uci || move.uci.length < 4) return;

      const from = move.uci.substring(0, 2);
      const to = move.uci.substring(2, 4);

      // Calculate WDL percentage
      const total = (move.wdl.wins || 0) + (move.wdl.draws || 0) + (move.wdl.losses || 0);
      if (total === 0) return;

      const winPct = (move.wdl.wins || 0) / total;
      const drawPct = (move.wdl.draws || 0) / total;

      // Color based on outcome
      let color;
      if (winPct > 0.7) {
        color = '#22c55e'; // Green - Winning
      } else if (drawPct > 0.5) {
        color = '#eab308'; // Yellow - Drawing
      } else {
        color = '#ef4444'; // Red - Losing
      }

      arrows.push([from, to, color]);
    });

    return arrows;
  };

  useEffect(() => {
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
  }, [fen, isAutoMoveEnabled, makeAutoOpponentMove, userColor]);

  return (
    <div className="chessboard-container-wrapper">
      <div className="chessboard-container">
        <Chessboard
          id="graphite-chessboard"
          options={{
            position: fen,
            onPieceDrop: onDrop,
            boardOrientation: boardOrientation,
            animationDuration: 300,
            arePiecesDraggable: true,
            allowDragOffBoard: false,
            customDarkSquareStyle: { backgroundColor: 'var(--board-dark)' },
            customLightSquareStyle: { backgroundColor: 'var(--board-light)' },
            customBoardStyle: {
              borderRadius: '6px',
              boxShadow: `0 5px 15px var(--shadow-color)`,
            },
            customArrows: [
              ...(lastMove ? [[lastMove.from, lastMove.to, 'var(--accent-primary)']] : []),
              ...calculateTablebaseArrows()
            ],
          }}
        />
      </div>
    </div>
  );
};

export default ChessboardContainer;
