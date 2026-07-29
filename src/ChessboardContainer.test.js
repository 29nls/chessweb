import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import ChessboardContainer from './ChessboardContainer';

// ── Mocks ──────────────────────────────────────────────

// Module-level variable to capture Chessboard props for assertion
// NOTE: must have 'mock' prefix so it can be referenced inside jest.mock factory
let mockChessboardProps = null;

// Mock react-chessboard v5 — all props are inside `options` object
jest.mock('react-chessboard', () => ({
  Chessboard: (props) => {
    mockChessboardProps = props;
    const opts = props.options || {};
    return (
      <div
        data-testid="mock-chessboard"
        data-position={opts.position}
        data-orientation={opts.boardOrientation}
        data-draggable={String(opts.allowDragging)}
        data-arrows={JSON.stringify(opts.arrows)}
        data-squares={JSON.stringify(opts.squareStyles)}
      />
    );
  },
}));

// Helper to access captured props from tests
const getMockChessboardProps = () => mockChessboardProps;
const resetMockChessboardProps = () => { mockChessboardProps = null; };

beforeEach(() => {
  resetMockChessboardProps();
});

// Mock console.warn used for error handling edge cases
jest.spyOn(console, 'warn').mockImplementation(() => {});

// ── Helpers ─────────────────────────────────────────────

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const defaultProps = {
  fen: STARTING_FEN,
  onDrop: jest.fn(),
  boardOrientation: 'white',
};

const renderBoard = (overrides = {}) => {
  const props = { ...defaultProps, ...overrides };
  const utils = render(<ChessboardContainer {...props} />);
  return { ...utils, props };
};

const getChessboard = () => screen.getByTestId('mock-chessboard');
const getWrapper = () => screen.getByTestId('chessboard');

// Shortcuts to access v5 options callbacks
const optsOnSquareClick = (square) => {
  getMockChessboardProps()?.options?.onSquareClick?.({ square });
};
const optsOnPieceDrop = (sourceSquare, targetSquare) => {
  return getMockChessboardProps()?.options?.onPieceDrop?.({ sourceSquare, targetSquare });
};

// ── Tests ───────────────────────────────────────────────

describe('ChessboardContainer — rendering', () => {
  test('renders the wrapper with data-testid', () => {
    renderBoard();
    expect(getWrapper()).toBeInTheDocument();
  });

  test('passes fen position to the Chessboard component (via options)', () => {
    renderBoard();
    expect(getChessboard()).toHaveAttribute('data-position', STARTING_FEN);
  });

  test('passes board orientation to the Chessboard component (via options)', () => {
    renderBoard({ boardOrientation: 'black' });
    expect(getChessboard()).toHaveAttribute('data-orientation', 'black');
  });

  test('makes pieces draggable when isSpectator is false (allowDragging=true)', () => {
    renderBoard({ isSpectator: false });
    expect(getChessboard()).toHaveAttribute('data-draggable', 'true');
  });

  test('disables dragging when isSpectator is true (allowDragging=false)', () => {
    renderBoard({ isSpectator: true });
    expect(getChessboard()).toHaveAttribute('data-draggable', 'false');
  });

  test('renders without crashing with minimal required props', () => {
    renderBoard();
    expect(getWrapper()).toBeInTheDocument();
  });
});

describe('ChessboardContainer — renders with minimal/no props', () => {
  test('does not crash when only required props provided', () => {
    const { container } = render(
      <ChessboardContainer
        fen={STARTING_FEN}
        onDrop={jest.fn()}
        boardOrientation="white"
      />
    );
    expect(container.querySelector('[data-testid="chessboard"]')).toBeInTheDocument();
  });

  test('does not crash with missing fen (optional in runtime)', () => {
    // React 19 no longer emits PropTypes warnings — just verify no crash
    expect(() => {
      render(<ChessboardContainer onDrop={jest.fn()} boardOrientation="white" />);
    }).not.toThrow();
  });

  test('does not crash with invalid boardOrientation', () => {
    // React 19 no longer emits PropTypes warnings — just verify no crash
    expect(() => {
      render(
        <ChessboardContainer fen={STARTING_FEN} onDrop={jest.fn()} boardOrientation="invalid" />
      );
    }).not.toThrow();
  });
});

describe('ChessboardContainer — last move highlights', () => {
  test('passes arrow in options.arrows when lastMove and showArrow are set', () => {
    renderBoard({ lastMove: { from: 'e2', to: 'e4' }, showArrow: true });

    const arrows = JSON.parse(getChessboard().getAttribute('data-arrows'));
    expect(arrows).toHaveLength(1);
    expect(arrows[0]).toMatchObject({
      startSquare: 'e2',
      endSquare: 'e4',
    });
  });

  test('omits arrows when showArrow is false', () => {
    renderBoard({ lastMove: { from: 'e2', to: 'e4' }, showArrow: false });

    const arrows = JSON.parse(getChessboard().getAttribute('data-arrows'));
    expect(arrows).toHaveLength(0);
  });

  test('omits arrows when lastMove is null', () => {
    renderBoard({ lastMove: null, showArrow: true });

    const arrows = JSON.parse(getChessboard().getAttribute('data-arrows'));
    expect(arrows).toHaveLength(0);
  });

  test('includes last move squares in options.squareStyles', () => {
    renderBoard({ lastMove: { from: 'e2', to: 'e4' } });

    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).toHaveProperty('e2');
    expect(squares).toHaveProperty('e4');
  });
});

describe('ChessboardContainer — checked king highlight', () => {
  test('adds red gradient style for the checked king square', () => {
    renderBoard({ checkedKingSquare: 'e1' });

    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).toHaveProperty('e1');
    expect(squares.e1.background).toContain('rgba(255,0,0');
  });

  test('does not add highlight when checkedKingSquare is null', () => {
    renderBoard({ checkedKingSquare: null });

    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).not.toHaveProperty('e1');
  });
});

describe('ChessboardContainer — custom square styles', () => {
  test('merges custom square styles with built-in highlights', () => {
    const customStyles = { e4: { background: 'gold' } };
    renderBoard({ customSquareStyles: customStyles, lastMove: { from: 'e2', to: 'e4' } });

    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).toHaveProperty('e4');
  });

  test('passes empty object when customSquareStyles is not provided', () => {
    renderBoard();
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).toBeDefined();
    expect(typeof squares).toBe('object');
  });
});

describe('ChessboardContainer — spectator mode', () => {
  test('disables piece dragging when isSpectator is true', () => {
    renderBoard({ isSpectator: true });
    expect(getChessboard()).toHaveAttribute('data-draggable', 'false');
  });
});

describe('ChessboardContainer — auto-move effect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('does not call makeAutoOpponentMove when isAutoMoveEnabled is false', () => {
    const makeAutoOpponentMove = jest.fn();
    renderBoard({ isAutoMoveEnabled: false, makeAutoOpponentMove, userColor: 'white' });

    jest.advanceTimersByTime(1000);
    expect(makeAutoOpponentMove).not.toHaveBeenCalled();
  });

  test('does not call makeAutoOpponentMove during player\'s turn', () => {
    // Starting FEN: 'w' to move, userColor 'white' → player's turn
    renderBoard({ isAutoMoveEnabled: true, makeAutoOpponentMove: jest.fn(), userColor: 'white' });

    jest.advanceTimersByTime(1000);
    expect(defaultProps.onDrop).not.toHaveBeenCalled();
  });

  test('calls makeAutoOpponentMove during opponent\'s turn after 500ms delay', () => {
    // FEN: black to move, userColor 'white' → opponent's turn
    const fenBlackTurn = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const makeAutoOpponentMove = jest.fn();
    renderBoard({
      fen: fenBlackTurn,
      isAutoMoveEnabled: true,
      makeAutoOpponentMove,
      userColor: 'white',
    });

    jest.advanceTimersByTime(600);
    expect(makeAutoOpponentMove).toHaveBeenCalledTimes(1);
  });

  test('does not trigger auto-move when isOnlineMode is true', () => {
    const fenBlackTurn = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const makeAutoOpponentMove = jest.fn();
    renderBoard({
      fen: fenBlackTurn,
      isAutoMoveEnabled: true,
      makeAutoOpponentMove,
      userColor: 'white',
      isOnlineMode: true,
    });

    jest.advanceTimersByTime(1000);
    expect(makeAutoOpponentMove).not.toHaveBeenCalled();
  });
});

describe('ChessboardContainer — prop updates on rerender', () => {
  test('forwards updated fen to the Chessboard component', () => {
    const { rerender } = render(
      <ChessboardContainer
        fen={STARTING_FEN}
        onDrop={jest.fn()}
        boardOrientation="white"
      />
    );

    const newFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    rerender(
      <ChessboardContainer
        fen={newFen}
        onDrop={jest.fn()}
        boardOrientation="white"
      />
    );

    expect(getChessboard()).toHaveAttribute('data-position', newFen);
  });
});

// ═══════════════════════════════════════════════════════════════
// CLICK-TO-MOVE INTERACTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('ChessboardContainer — click-to-move', () => {
  test('click on a piece selects it and shows legal move dots', () => {
    renderBoard();

    // v5 API: onSquareClick receives { square, piece }
    act(() => { optsOnSquareClick('e2'); });

    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    // Selected square highlighted
    expect(squares).toHaveProperty('e2');
    expect(squares.e2.background).toContain('rgba(155, 199, 0, 0.6)');
    // Legal move destinations: pawn can move 1 or 2 squares forward
    expect(squares).toHaveProperty('e3');
    expect(squares).toHaveProperty('e4');
    // Legal move dot uses radial-gradient pattern
    expect(squares.e3.background).toContain('radial-gradient');
    expect(squares.e4.background).toContain('radial-gradient');
  });

  test('click on legal move destination calls onDrop with source and target', () => {
    const onDrop = jest.fn(() => true);
    renderBoard({ onDrop });

    act(() => { optsOnSquareClick('e2'); });
    act(() => { optsOnSquareClick('e4'); });

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith({ sourceSquare: 'e2', targetSquare: 'e4' });
  });

  test('click on same square deselects', () => {
    renderBoard();

    act(() => { optsOnSquareClick('e2'); });
    expect(JSON.parse(getChessboard().getAttribute('data-squares'))).toHaveProperty('e2');

    act(() => { optsOnSquareClick('e2'); });
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).not.toHaveProperty('e2');
  });

  test('click on illegal square after selection does not call onDrop', () => {
    const onDrop = jest.fn();
    renderBoard({ onDrop });

    act(() => { optsOnSquareClick('e2'); });
    act(() => { optsOnSquareClick('e5'); }); // e5 is too far for a pawn

    expect(onDrop).not.toHaveBeenCalled();
  });

  test('click on opponent piece after selection does not call onDrop', () => {
    const onDrop = jest.fn();
    renderBoard({ onDrop });

    act(() => { optsOnSquareClick('e2'); });
    act(() => { optsOnSquareClick('e7'); }); // e7 has opponent pawn

    expect(onDrop).not.toHaveBeenCalled();
  });

  test('click another friendly piece re-selects to the new piece', () => {
    renderBoard();

    act(() => { optsOnSquareClick('e2'); });
    act(() => { optsOnSquareClick('g1'); }); // g1 has white knight

    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).not.toHaveProperty('e2'); // old selection cleared
    expect(squares).toHaveProperty('g1'); // knight selected
    // Knight legal moves: f3 and h3
    expect(squares).toHaveProperty('f3');
    expect(squares).toHaveProperty('h3');
  });

  test('onDrop returning false preserves selection (Bug #4 fix)', () => {
    const onDrop = jest.fn(() => false);
    renderBoard({ onDrop });

    act(() => { optsOnSquareClick('e2'); });
    expect(JSON.parse(getChessboard().getAttribute('data-squares'))).toHaveProperty('e2');

    // onDrop returns false → selection should be preserved
    act(() => { optsOnSquareClick('e4'); });
    expect(onDrop).toHaveBeenCalledWith({ sourceSquare: 'e2', targetSquare: 'e4' });
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).toHaveProperty('e2');
  });

  test('click-to-move selects different pieces independently', () => {
    // Position with knights on c3 and f3 showing different legal move sets
    const fenWithKnights = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 2 5';
    renderBoard({ fen: fenWithKnights });

    // Click knight on f3
    act(() => { optsOnSquareClick('f3'); });
    let squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).toHaveProperty('f3');
    expect(squares).toHaveProperty('g5');
    expect(squares).toHaveProperty('e5');

    // Click opponent piece (e5 has black pawn) to discard selection
    act(() => { optsOnSquareClick('e5'); });

    // Click knight on c3
    act(() => { optsOnSquareClick('c3'); });
    squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).toHaveProperty('c3');
    expect(squares).toHaveProperty('b5');
    expect(squares).toHaveProperty('d5');
  });
});

// ═══════════════════════════════════════════════════════════════
// DRAG-TO-MOVE INTERACTION TESTS
// ═══════════════════════════════════════════════════════════════

describe('ChessboardContainer — drag-to-move', () => {
  test('onPieceDrop calls onDrop with source and target', () => {
    const onDrop = jest.fn(() => true);
    renderBoard({ onDrop });

    // v5 API: onPieceDrop receives { piece, sourceSquare, targetSquare }
    act(() => { optsOnPieceDrop('e2', 'e4'); });

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop).toHaveBeenCalledWith({ sourceSquare: 'e2', targetSquare: 'e4' });
  });

  test('onPieceDrop with accepted move clears selected square immediately (Bug #8 fix)', () => {
    const onDrop = jest.fn(() => true);
    renderBoard({ onDrop });

    // First select a square via click
    act(() => { optsOnSquareClick('e2'); });
    expect(JSON.parse(getChessboard().getAttribute('data-squares'))).toHaveProperty('e2');

    // Drag to a target — should clear selection immediately (not wait for FEN change)
    act(() => { optsOnPieceDrop('e2', 'e4'); });
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).not.toHaveProperty('e2');
  });

  test('onPieceDrop with rejected move preserves selected square', () => {
    const onDrop = jest.fn(() => false);
    renderBoard({ onDrop });

    // Select via click
    act(() => { optsOnSquareClick('e2'); });
    expect(JSON.parse(getChessboard().getAttribute('data-squares'))).toHaveProperty('e2');

    // Drag to illegal target — onDrop returns false → selection preserved
    act(() => { optsOnPieceDrop('e2', 'e5'); });
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).toHaveProperty('e2');
  });

  test('onPieceDrop returns onDrop result to chessboard for snap-back', () => {
    const onDropSuccess = jest.fn(() => true);
    renderBoard({ onDrop: onDropSuccess });

    let result;
    act(() => {
      result = optsOnPieceDrop('e2', 'e4');
    });
    expect(result).toBe(true);

    const onDropFail = jest.fn(() => false);
    renderBoard({ onDrop: onDropFail });

    act(() => {
      result = optsOnPieceDrop('e2', 'e5');
    });
    expect(result).toBe(false);
  });

  // Edge case: drag after click-selection — both paths should work independently
  test('drag-to-move works independently of click selection state', () => {
    const onDrop = jest.fn(() => true);
    renderBoard({ onDrop });

    // Select a piece via click first
    act(() => { optsOnSquareClick('g1'); });
    expect(JSON.parse(getChessboard().getAttribute('data-squares'))).toHaveProperty('g1');

    // Drag a DIFFERENT piece (bypasses click selection)
    act(() => { optsOnPieceDrop('b1', 'c3'); });

    // onDrop should be called with the drag source/target, not the click selection
    expect(onDrop).toHaveBeenCalledWith({ sourceSquare: 'b1', targetSquare: 'c3' });

    // Selection should have been cleared by the drag
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).not.toHaveProperty('g1');
    expect(squares).not.toHaveProperty('b1');
  });
});

// ═══════════════════════════════════════════════════════════════
// SPECTATOR MODE BLOCKS INTERACTIONS
// ═══════════════════════════════════════════════════════════════

describe('ChessboardContainer — spectator mode blocks interactions', () => {
  test('onSquareClick does not trigger onDrop when isSpectator is true', () => {
    const onDrop = jest.fn();
    renderBoard({ isSpectator: true, onDrop });

    act(() => { optsOnSquareClick('e2'); });

    expect(onDrop).not.toHaveBeenCalled();
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).not.toHaveProperty('e2');
  });

  test('pieces are not draggable when isSpectator is true', () => {
    renderBoard({ isSpectator: true });
    expect(getChessboard()).toHaveAttribute('data-draggable', 'false');
  });
});

// ═══════════════════════════════════════════════════════════════
// REGRESSION: selected square reset on FEN change
// ═══════════════════════════════════════════════════════════════

describe('ChessboardContainer — selection reset on FEN change', () => {
  test('selected square and legal moves clear when fen prop changes', () => {
    const { rerender } = render(
      <ChessboardContainer
        fen={STARTING_FEN}
        onDrop={jest.fn(() => true)}
        boardOrientation="white"
      />
    );

    // Select a square
    act(() => { optsOnSquareClick('e2'); });
    expect(JSON.parse(getChessboard().getAttribute('data-squares'))).toHaveProperty('e2');

    // FEN changes (opponent moved)
    const newFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    rerender(
      <ChessboardContainer
        fen={newFen}
        onDrop={jest.fn(() => true)}
        boardOrientation="white"
      />
    );

    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).not.toHaveProperty('e2');
  });
});

// ═══════════════════════════════════════════════════════════════
// CAPTURE MOVE DETECTION
// ═══════════════════════════════════════════════════════════════

describe('ChessboardContainer — capture highlight detection', () => {
  test('pawn capture squares show capture-style dot instead of regular dot', () => {
    // Position where white pawn on e4 can:
    // - move to e5 (regular)
    // - capture on d5 (black pawn)
    // - capture on f5 (black pawn)
    // FEN: black pawns on c5, d5, f5; white pawn on e4
    const fenCapture = 'rnbqkbnr/pp3ppp/8/2pp1p2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    renderBoard({ fen: fenCapture });

    act(() => { optsOnSquareClick('e4'); });

    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    // e5 is a regular move (no capture) — uses dot pattern
    expect(squares.e5.background).toContain('rgba(20, 85, 30, 0.5)');
    // d5 and f5 are capture squares — use capture pattern (transparent center, green ring)
    expect(squares.d5.background).toContain('transparent');
    expect(squares.d5.background).toContain('rgba(20, 85, 30');
    expect(squares.f5.background).toContain('transparent');
    expect(squares.f5.background).toContain('rgba(20, 85, 30');
  });
});

// ═══════════════════════════════════════════════════════════════
// onSquareClick PROP DELEGATION
// ═══════════════════════════════════════════════════════════════

describe('ChessboardContainer — onSquareClick prop override', () => {
  test('when onSquareClick prop is set, internal selection logic is skipped', () => {
    const customOnSquareClick = jest.fn();
    const onDrop = jest.fn();
    renderBoard({ onSquareClick: customOnSquareClick, onDrop });

    act(() => { optsOnSquareClick('e2'); });

    // Custom handler should be called with the square
    expect(customOnSquareClick).toHaveBeenCalledWith('e2');
    // Internal selection should NOT have happened
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    expect(squares).not.toHaveProperty('e2');
    // onDrop should NOT be called via internal click-to-move
    expect(onDrop).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// React.memo OPTIMIZATION
// ═══════════════════════════════════════════════════════════════

describe('ChessboardContainer — React.memo prevents unnecessary re-renders', () => {
  test('does not re-render when props are identical (shallow equal)', () => {
    const props = {
      fen: STARTING_FEN,
      onDrop: jest.fn(),
      boardOrientation: 'white',
    };

    const { rerender } = render(<ChessboardContainer {...props} />);

    // Capture the initial data-squares attribute value
    const initialSquares = getChessboard().getAttribute('data-squares');

    // Re-render with identical props (same references)
    rerender(<ChessboardContainer {...props} />);

    // The mock Chessboard should NOT have re-rendered (same data-squares content)
    const afterSquares = getChessboard().getAttribute('data-squares');
    expect(afterSquares).toBe(initialSquares);
  });

  test('re-renders when fen changes', () => {
    const props = {
      fen: STARTING_FEN,
      onDrop: jest.fn(),
      boardOrientation: 'white',
    };

    const { rerender } = render(<ChessboardContainer {...props} />);

    const initialPosition = getChessboard().getAttribute('data-position');

    const newFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    rerender(<ChessboardContainer {...props} fen={newFen} />);

    expect(getChessboard().getAttribute('data-position')).not.toBe(initialPosition);
    expect(getChessboard().getAttribute('data-position')).toBe(newFen);
  });

  test('re-renders when boardOrientation changes', () => {
    const props = {
      fen: STARTING_FEN,
      onDrop: jest.fn(),
      boardOrientation: 'white',
    };

    const { rerender } = render(<ChessboardContainer {...props} />);
    const initialOrientation = getChessboard().getAttribute('data-orientation');

    rerender(<ChessboardContainer {...props} boardOrientation="black" />);

    expect(getChessboard().getAttribute('data-orientation')).not.toBe(initialOrientation);
    expect(getChessboard().getAttribute('data-orientation')).toBe('black');
  });
});

// ═══════════════════════════════════════════════════════════════
// KEYBOARD NAVIGATION
// ═══════════════════════════════════════════════════════════════

describe('ChessboardContainer — keyboard navigation', () => {
  const getWrapper = () => screen.getByRole('group');
  const getKeyboardSquareStyle = () => {
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    return squares;
  };

  test('wrapper is focusable and has accessible label', () => {
    renderBoard();
    const wrapper = getWrapper();
    expect(wrapper).toHaveAttribute('tabIndex', '0');
    expect(wrapper.getAttribute('aria-label')).toMatch(/Chessboard/);
  });

  test('focus starts keyboard cursor on a useful square', () => {
    renderBoard();
    act(() => { getWrapper().focus(); });
    // Starting position is white to move; the cursor should be on a white piece square
    const squares = getKeyboardSquareStyle();
    const focusedSquare = Object.entries(squares).find(([, style]) => style.boxShadow);
    expect(focusedSquare).toBeTruthy();
    expect(focusedSquare[0]).toBe('e2');
  });

  test('arrow keys move the keyboard square in white orientation', () => {
    renderBoard();
    act(() => { getWrapper().focus(); });

    act(() => { fireEvent.keyDown(getWrapper(), { key: 'ArrowRight' }); });
    let squares = getKeyboardSquareStyle();
    expect(squares.f2).toHaveProperty('boxShadow');

    act(() => { fireEvent.keyDown(getWrapper(), { key: 'ArrowUp' }); });
    squares = getKeyboardSquareStyle();
    expect(squares.f3).toHaveProperty('boxShadow');
  });

  test('Enter triggers a move from keyboard cursor', () => {
    const onDrop = jest.fn(() => true);
    renderBoard({ onDrop });

    act(() => { getWrapper().focus(); });
    // Select e2, move the cursor to e4, then confirm with Enter
    act(() => { fireEvent.keyDown(getWrapper(), { key: 'Enter' }); });
    act(() => { fireEvent.keyDown(getWrapper(), { key: 'ArrowUp' }); });
    act(() => { fireEvent.keyDown(getWrapper(), { key: 'ArrowUp' }); });
    act(() => { fireEvent.keyDown(getWrapper(), { key: 'Enter' }); });

    expect(onDrop).toHaveBeenCalledWith({ sourceSquare: 'e2', targetSquare: 'e4' });
  });

  test('Space also selects/moves from keyboard cursor', () => {
    const onDrop = jest.fn(() => true);
    renderBoard({ onDrop });

    act(() => { getWrapper().focus(); });
    // Select e2, move the cursor to e3, then confirm with Space
    act(() => { fireEvent.keyDown(getWrapper(), { key: 'Enter' }); });
    act(() => { fireEvent.keyDown(getWrapper(), { key: 'ArrowUp' }); });
    act(() => { fireEvent.keyDown(getWrapper(), { key: ' ' }); });

    expect(onDrop).toHaveBeenCalledWith({ sourceSquare: 'e2', targetSquare: 'e3' });
  });

  test('Escape clears selected square and legal moves', () => {
    renderBoard();
    act(() => { getWrapper().focus(); });
    act(() => { fireEvent.keyDown(getWrapper(), { key: 'Enter' }); }); // select e2
    // Legal move dots should be present
    expect(JSON.parse(getChessboard().getAttribute('data-squares'))).toHaveProperty('e3');

    // Move keyboard cursor away so the original square only keeps the selected highlight
    act(() => { fireEvent.keyDown(getWrapper(), { key: 'ArrowRight' }); });
    act(() => { fireEvent.keyDown(getWrapper(), { key: 'Escape' }); });
    const squares = JSON.parse(getChessboard().getAttribute('data-squares'));
    // The selected square highlight and legal move dots are removed
    expect(squares).not.toHaveProperty('e2');
    expect(squares).not.toHaveProperty('e3');
  });

  test('arrow keys invert when board orientation is black', () => {
    renderBoard({ boardOrientation: 'black' });
    act(() => { getWrapper().focus(); });

    act(() => { fireEvent.keyDown(getWrapper(), { key: 'ArrowRight' }); });
    const squares = getKeyboardSquareStyle();
    // From e2, black orientation right should move toward the d-file
    expect(squares.d2).toHaveProperty('boxShadow');
  });

  test('keyboard navigation is disabled in spectator mode', () => {
    renderBoard({ isSpectator: true });
    act(() => { getWrapper().focus(); });

    act(() => { fireEvent.keyDown(getWrapper(), { key: 'ArrowUp' }); });
    const squares = getKeyboardSquareStyle();
    const focusedSquare = Object.entries(squares).find(([, style]) => style.boxShadow);
    expect(focusedSquare).toBeFalsy();
  });
});
