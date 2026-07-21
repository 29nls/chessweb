import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

const ChessboardContainer = ({
  fen,
  onDrop,
  onSquareClick,
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

  // Legal move highlight state — stores both destination squares + capture targets
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [captureSquares, setCaptureSquares] = useState(new Set());

  // Reset selection when FEN changes (opponent moved, etc.)
  useEffect(() => {
    setSelectedSquare(null);
    setLegalMoves([]);
    setCaptureSquares(new Set());
  }, [fen]);

  // Compute legal moves for a given square
  const computeLegalMoves = useCallback((square, gameFen) => {
    try {
      const game = new Chess(gameFen);
      const moves = game.moves({ square, verbose: true });
      const destinations = moves.map(m => m.to);
      const captures = new Set(moves.filter(m => m.flags && (m.flags.includes('c') || m.flags.includes('e'))).map(m => m.to));
      setCaptureSquares(captures);
      return destinations;
    } catch {
      setCaptureSquares(new Set());
      return [];
    }
  }, []);

  const handleSquareClick = (square) => {
    // If spectator or online mode without click handler, ignore
    if (isSpectator) return;

    // If we have a click handler from parent (for custom logic), use that
    if (onSquareClick) {
      onSquareClick(square);
      return;
    }

    if (selectedSquare) {
      // If clicking the same square, deselect
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // If clicking a legal move destination, make the move
      if (legalMoves.includes(square)) {
        const success = onDrop({ sourceSquare: selectedSquare, targetSquare: square });
        setSelectedSquare(null);
        setLegalMoves([]);
        return success;
      }

      // If clicking another piece of the same color, select it instead
      try {
        const game = new Chess(fen);
        const piece = game.get(square);
        const selectedPiece = game.get(selectedSquare);
        if (piece && selectedPiece && piece.color === selectedPiece.color) {
          setSelectedSquare(square);
          setLegalMoves(computeLegalMoves(square, fen));
          return;
        }
      } catch {}
    }

    // Select this square and compute legal moves
    setSelectedSquare(square);
    setLegalMoves(computeLegalMoves(square, fen));
  };

  // Gunakan ref untuk callback agar tidak re-run effect saat makeAutoOpponentMove berubah referensi
  const makeAutoMoveRef = useRef(makeAutoOpponentMove);
  makeAutoMoveRef.current = makeAutoOpponentMove;

  useEffect(() => {
    // Update ref BEFORE any conditional logic, agar selalu sinkron
    prevFenRef.current = fen;

    // Disable auto-move in online mode — opponent moves come via Supabase
    if (isOnlineMode) return;

    // Only run if the FEN has changed and auto-move is enabled.
    if (isAutoMoveEnabled) {
      const turn = fen.split(' ')[1];
      const playerIsWhite = userColor === 'white';
      const isOpponentTurn = (playerIsWhite && turn === 'b') || (!playerIsWhite && turn === 'w');

      if (isOpponentTurn) {
        // Delay the engine's move to feel more natural
        const timerId = setTimeout(() => {
          makeAutoMoveRef.current();
        }, 500);

        return () => clearTimeout(timerId);
      }
    }
  }, [fen, isAutoMoveEnabled, userColor, isOnlineMode]); // makeAutoOpponentMove dihilangkan dari deps -- pakai ref

  // Build square styles: legal move dots + check highlight + last move highlight
  const squareStyles = {};

  // Last move highlight
  if (lastMove) {
    squareStyles[lastMove.from] = {
      background: 'rgba(155, 199, 0, 0.41)',
      borderRadius: '0',
    };
    squareStyles[lastMove.to] = {
      background: 'rgba(155, 199, 0, 0.41)',
      borderRadius: '0',
    };
  }

  // Check highlight
  if (checkedKingSquare) {
    squareStyles[checkedKingSquare] = {
      background: 'radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(255,0,0,0.4) 40%, rgba(255,0,0,0) 80%)',
      borderRadius: '50%',
    };
  }

  // Selected square highlight
  if (selectedSquare) {
    squareStyles[selectedSquare] = {
      background: 'rgba(155, 199, 0, 0.6)',
      borderRadius: '0',
    };
  }

  // Legal move dots — gunakan captureSquares yang sudah di-compute saat selection
  legalMoves.forEach(sq => {
    const isCapture = captureSquares.has(sq);

    if (squareStyles[sq]) {
      // Merge with existing style (e.g., check highlight)
      squareStyles[sq] = {
        ...squareStyles[sq],
        background: isCapture
          ? 'radial-gradient(transparent 0%, transparent 70%, rgba(20, 85, 30, 0.4) 70%, rgba(20, 85, 30, 0.6) 100%)'
          : 'radial-gradient(rgba(20, 85, 30, 0.5) 0%, rgba(20, 85, 30, 0.5) 20%, transparent 20%, transparent 100%)',
      };
    } else {
      squareStyles[sq] = isCapture
        ? { background: 'radial-gradient(transparent 0%, transparent 70%, rgba(20, 85, 30, 0.4) 70%, rgba(20, 85, 30, 0.6) 100%)' }
        : { background: 'radial-gradient(rgba(20, 85, 30, 0.5) 0%, rgba(20, 85, 30, 0.5) 15%, transparent 15%, transparent 100%)' };
    }
  });

  return (
    <div className="chessboard-container-wrapper" data-testid="chessboard">
      <div className="chessboard-container">
        <Chessboard
          options={{
            id: 'graphite-chessboard',
            position: fen,
            onPieceDrop: ({ sourceSquare, targetSquare }) => onDrop({ sourceSquare, targetSquare }),
            onSquareClick: ({ square }) => handleSquareClick(square),
            boardOrientation: boardOrientation,
            animationDurationInMs: 300,
            allowDragging: !isSpectator,
            darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
            lightSquareStyle: { backgroundColor: 'var(--board-light)' },
            boardStyle: {
              borderRadius: '6px',
              boxShadow: '0 5px 15px var(--shadow-color)',
            },
            arrows: lastMove
              ? [{ startSquare: lastMove.from, endSquare: lastMove.to, color: 'var(--accent-primary)' }]
              : [],
            squareStyles: squareStyles,
          }}
        />
      </div>
    </div>
  );
};

export default ChessboardContainer;
