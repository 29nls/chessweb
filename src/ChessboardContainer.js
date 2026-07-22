import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

/**
 * ChessboardContainer — Wraps react-chessboard with legal move display,
 * square selection, move highlights, and auto-opponent support.
 *
 * @param {Object} props
 * @param {string} props.fen - Current board position in FEN notation.
 * @param {(move: {sourceSquare: string, targetSquare: string}) => boolean} props.onDrop
 *   Called when a piece is dropped or a legal-move click is made. Return `true` on success.
 * @param {(square: string) => void} [props.onSquareClick]
 *   Custom click handler override (skips internal selection logic when set).
 * @param {'white'|'black'} props.boardOrientation - Which side is at the bottom.
 * @param {{from: string, to: string}|null} [props.lastMove]
 *   Last played move squares for highlight styling.
 * @param {boolean} [props.isAutoMoveEnabled=false]
 *   When true, engine auto-responds to the player's move.
 * @param {() => void} [props.makeAutoOpponentMove]
 *   Callback invoked when the engine should make its move.
 * @param {'white'|'black'} [props.userColor] - The human player's color.
 * @param {boolean} [props.isOnlineMode=false]
 *   Disables auto-move; opponent moves arrive via Supabase.
 * @param {boolean} [props.isSpectator=false]
 *   Disables piece dragging and square clicks.
 * @param {string|null} [props.checkedKingSquare=null]
 *   Square of the king in check, for red highlight.
 * @param {boolean} [props.showArrow=true]
 *   Whether to draw an arrow on the last move.
 * @param {Object<string, Object>} [props.customSquareStyles={}]
 *   Additional square styles merged over defaults (used for puzzle hints).
 */
const ChessboardContainer = React.memo(({
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
  showArrow = true,
  customSquareStyles = {},
}) => {

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
    } catch (err) {
      console.warn('Chessboard: Failed to compute legal moves for', square, err);
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
      // Note: onSquareClick's return value is unused by react-chessboard,
      // so we consistently return void on all paths for code clarity.
      if (legalMoves.includes(square)) {
        const success = onDrop({ sourceSquare: selectedSquare, targetSquare: square });
        // Bugfix #4: only clear selection if the move was accepted
        if (success !== false) {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
        return;
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
      } catch (err) {
        console.warn('Chessboard: Failed to check piece color on', square, err);
      }
    }

    // Select this square and compute legal moves
    setSelectedSquare(square);
    setLegalMoves(computeLegalMoves(square, fen));
  };

  // Gunakan ref untuk callback agar tidak re-run effect saat makeAutoOpponentMove berubah referensi
  const makeAutoMoveRef = useRef(makeAutoOpponentMove);
  makeAutoMoveRef.current = makeAutoOpponentMove;

  useEffect(() => {
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
  // Merge with any custom styles from parent (e.g., puzzle hints)
  // Bugfix #3: memoize to avoid unnecessary re-renders of react-chessboard
  const squareStyles = useMemo(() => {
    const styles = { ...customSquareStyles };

    // Last move highlight
    if (lastMove) {
      styles[lastMove.from] = {
        background: 'rgba(155, 199, 0, 0.41)',
        borderRadius: '0',
      };
      styles[lastMove.to] = {
        background: 'rgba(155, 199, 0, 0.41)',
        borderRadius: '0',
      };
    }

    // Check highlight
    if (checkedKingSquare) {
      styles[checkedKingSquare] = {
        background: 'radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(255,0,0,0.4) 40%, rgba(255,0,0,0) 80%)',
        borderRadius: '50%',
      };
    }

    // Selected square highlight
    if (selectedSquare) {
      styles[selectedSquare] = {
        background: 'rgba(155, 199, 0, 0.6)',
        borderRadius: '0',
      };
    }

    // Legal move dots — gunakan captureSquares yang sudah di-compute saat selection
    legalMoves.forEach(sq => {
      const isCapture = captureSquares.has(sq);

      if (styles[sq]) {
        // Merge with existing style (e.g., check highlight)
        styles[sq] = {
          ...styles[sq],
          background: isCapture
            ? 'radial-gradient(transparent 0%, transparent 70%, rgba(20, 85, 30, 0.4) 70%, rgba(20, 85, 30, 0.6) 100%)'
            : 'radial-gradient(rgba(20, 85, 30, 0.5) 0%, rgba(20, 85, 30, 0.5) 20%, transparent 20%, transparent 100%)',
        };
      } else {
        styles[sq] = isCapture
          ? { background: 'radial-gradient(transparent 0%, transparent 70%, rgba(20, 85, 30, 0.4) 70%, rgba(20, 85, 30, 0.6) 100%)' }
          : { background: 'radial-gradient(rgba(20, 85, 30, 0.5) 0%, rgba(20, 85, 30, 0.5) 15%, transparent 15%, transparent 100%)' };
      }
    });

    return styles;
  }, [customSquareStyles, lastMove, checkedKingSquare, selectedSquare, legalMoves, captureSquares]);

  // react-chessboard v5 API: all props go inside an `options` object.
  // Callbacks receive objects: onPieceDrop({piece, sourceSquare, targetSquare}),
  // onSquareClick({piece, square}).
  // Props renamed: arePiecesDraggable→allowDragging, customXxx→xxx, animationDuration→animationDurationInMs.
  const boardOptions = useMemo(() => ({
    id: 'graphite-chessboard',
    position: fen,
    boardOrientation,
    animationDurationInMs: 300,
    allowDragging: !isSpectator,
    darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
    lightSquareStyle: { backgroundColor: 'var(--board-light)' },
    boardStyle: {
      borderRadius: '6px',
      boxShadow: '0 5px 15px var(--shadow-color)',
    },
    arrows: lastMove && showArrow
      ? [{ startSquare: lastMove.from, endSquare: lastMove.to, color: 'var(--accent-primary)' }]
      : [],
    squareStyles,

    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      // Bugfix #8: clear selected square immediately after drag-and-drop,
      // instead of waiting for the FEN-change effect (avoids visual flicker)
      const result = onDrop({ sourceSquare, targetSquare });
      if (result !== false) {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
      return result;
    },

    onSquareClick: ({ square }) => handleSquareClick(square),
  }), [
    fen,
    boardOrientation,
    isSpectator,
    lastMove,
    showArrow,
    squareStyles,
    onDrop,
  ]);

  return (
    <div className="chessboard-container-wrapper" data-testid="chessboard">
      <div className="chessboard-container">
        <Chessboard options={boardOptions} />
      </div>
    </div>
  );
});

ChessboardContainer.propTypes = {
  /** Current board position in FEN notation */
  fen: PropTypes.string.isRequired,

  /**
   * Called when a piece is dropped or a legal-move click is made.
   * Return `true` from this callback to indicate the move was accepted.
   */
  onDrop: PropTypes.func.isRequired,

  /**
   * Custom click handler override. When set, the internal square-selection
   * and legal-move logic is skipped in favour of this callback.
   */
  onSquareClick: PropTypes.func,

  /** Which side is at the bottom of the board: 'white' or 'black' */
  boardOrientation: PropTypes.oneOf(['white', 'black']).isRequired,

  /** Last played move squares for highlight styling: `{ from, to }` */
  lastMove: PropTypes.shape({
    from: PropTypes.string,
    to: PropTypes.string,
  }),

  /** When true, the engine will auto-respond to the player's move */
  isAutoMoveEnabled: PropTypes.bool,

  /** Callback invoked when the engine should make its move */
  makeAutoOpponentMove: PropTypes.func,

  /** The human player's color — 'white', 'black', or 'spectator' (online mode) */
  userColor: PropTypes.oneOf(['white', 'black', 'spectator']),

  /**
   * When true, disables the auto-move effect.
   * Opponent moves arrive in-band via Supabase Realtime.
   */
  isOnlineMode: PropTypes.bool,

  /** When true, piece dragging and square clicks are disabled */
  isSpectator: PropTypes.bool,

  /** Square of the king in check (e.g. 'e1'), rendered with a red highlight */
  checkedKingSquare: PropTypes.string,

  /** Whether to draw an arrow showing the last move */
  showArrow: PropTypes.bool,

  /**
   * Additional square styles merged over the built-in highlight defaults.
   * Used by PuzzlePage for hint and wrong-move indicators.
   * Example: `{ e4: { background: 'radial-gradient(...)' } }`
   */
  customSquareStyles: PropTypes.objectOf(PropTypes.object),
};

export default ChessboardContainer;
