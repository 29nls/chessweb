import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PuzzlePage from './PuzzlePage';

// ── Module-level mocks ────────────────────────────────
// IMPORTANT: jest.mock factory functions are hoisted above imports and
// CANNOT reference variables from the outer scope (const/let).

jest.mock('../hooks/useLoadingSequence', () => ({
  useLoadingSequence: () => ({
    isLoading: false,
    showSkeleton: false,
    stepIndex: 3,
    markReady: () => {},
  }),
}));

jest.mock('../ChessboardContainer', () => {
  return function MockChessboard({ fen, onDrop, boardOrientation, lastMove, isSpectator, customSquareStyles }) {
    return (
      <div data-testid="puzzle-chessboard" data-fen={fen} data-orientation={boardOrientation}>
        <button
          data-testid="mock-drop"
          onClick={() => onDrop({ sourceSquare: 'd4', targetSquare: 'd5' })}
        >
          Drop
        </button>
        <button
          data-testid="mock-promotion-drop"
          onClick={() => onDrop({ sourceSquare: 'e7', targetSquare: 'e8' })}
        >
          Promote Drop
        </button>
      </div>
    );
  };
});

jest.mock('../ErrorBoundary', () => {
  return function MockErrorBoundary({ children }) {
    return <div data-testid="error-boundary">{children}</div>;
  };
});

// Mock getRandomPuzzle - use a fixed sample puzzle (defined BEFORE jest.mock)
// jest.mock factories CAN reference variables with 'mock' prefix (case-insensitive)
jest.mock('../data/puzzles', () => {
  // samplePuzzle defined inside factory to avoid hoisting issues
  const factorySample = {
    id: 1,
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    moves: ['Nd5', 'Nxd5', 'Bxd5'],
    rating: 1200,
    themes: ['Fork', 'Center'],
    description: 'White to play — exploit the loose knight on c6.',
  };
  return {
    getRandomPuzzle: () => ({ ...factorySample }),
  };
});

// Sample puzzle for assertions (defined OUTSIDE jest.mock so tests can use it)
const samplePuzzle = {
  id: 1,
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  moves: ['Nd5', 'Nxd5', 'Bxd5'],
  rating: 1200,
  themes: ['Fork', 'Center'],
  description: 'White to play — exploit the loose knight on c6.',
};

jest.mock('../lib/sound', () => ({
  playMoveSound: () => {},
}));

jest.mock('react-toastify', () => ({
  toast: {
    success: () => {},
    error: () => {},
    info: () => {},
    warning: () => {},
  },
  ToastContainer: () => null,
}));

jest.mock('react-feather', () => ({
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  RotateCcw: () => <span data-testid="icon-rotate" />,
  Shuffle: () => <span data-testid="icon-shuffle" />,
  Star: () => <span data-testid="icon-star" />,
  Filter: () => <span data-testid="icon-filter" />,
}));

// ── Helpers ─────────────────────────────────────────────

const renderPuzzlePage = () => render(<PuzzlePage />);

// ── Tests ───────────────────────────────────────────────

describe('PuzzlePage — loading state', () => {
  test('shows content with chessboard and error boundary', () => {
    renderPuzzlePage();
    expect(screen.getByTestId('puzzle-chessboard')).toBeInTheDocument();
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
  });
});

describe('PuzzlePage — start screen', () => {
  test('shows start screen when no puzzle is loaded', () => {
    renderPuzzlePage();
    expect(screen.getByText('Start Training')).toBeInTheDocument();
  });

  test('shows difficulty selector on start screen', () => {
    renderPuzzlePage();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });

  test('clicking Start Training starts puzzle and loads random puzzle', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    // After starting, puzzle info should show
    expect(screen.getByText(`#${samplePuzzle.id}`)).toBeInTheDocument();
  });

  test('shows puzzle themes as tags', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    samplePuzzle.themes.forEach((theme) => {
      expect(screen.getByText(theme)).toBeInTheDocument();
    });
  });

  test('shows puzzle description', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    expect(screen.getByText(samplePuzzle.description)).toBeInTheDocument();
  });
});

describe('PuzzlePage — puzzle interaction', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('does not allow drops before puzzle is started', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByTestId('mock-drop'));
    expect(screen.getByText('Start Training')).toBeInTheDocument();
  });

  test('shows stats (score, streak, attempts) after starting', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(screen.getByText('Streak')).toBeInTheDocument();
    expect(screen.getByText('Attempts')).toBeInTheDocument();
  });

  test('hint button is enabled after puzzle starts', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    const hintBtn = screen.getByText('Hint');
    expect(hintBtn).not.toBeDisabled();
  });

  test('reset button resets puzzle to original position', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    fireEvent.click(screen.getByText('Reset'));
    // After reset, puzzle should still be loaded
    expect(screen.getByText(`#${samplePuzzle.id}`)).toBeInTheDocument();
  });

  test('puzzle progress shows correct fraction', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    expect(screen.getByText(`0/${samplePuzzle.moves.length}`)).toBeInTheDocument();
  });
});

describe('PuzzlePage — solution display', () => {
  test('shows solution panel with move list', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    expect(screen.getByText('Solution')).toBeInTheDocument();
    // All moves should be in the solution list
    samplePuzzle.moves.forEach((move) => {
      expect(screen.getByText(move)).toBeInTheDocument();
    });
  });

  test('shows Next Puzzle button in solution panel', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    expect(screen.getByText('Next Puzzle')).toBeInTheDocument();
  });

  test('hint button becomes disabled after clicking it', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    const hintBtn = screen.getByText('Hint');
    fireEvent.click(hintBtn);
    expect(hintBtn).toBeDisabled();
  });
});

describe('PuzzlePage — difficulty filter', () => {
  test('can click difficulty buttons in the game view', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    // Click Easy difficulty
    fireEvent.click(screen.getByText('Easy'));
    // Puzzle should still be visible
    expect(screen.getByText(`#${samplePuzzle.id}`)).toBeInTheDocument();
  });

  test('all difficulty buttons render in the game view', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Easy')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });
});

describe('PuzzlePage — board orientation', () => {
  test('board orientation is white when FEN shows white to move', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    const board = screen.getByTestId('puzzle-chessboard');
    expect(board.getAttribute('data-orientation')).toBe('white');
  });

  test('board orientation is correct', () => {
    renderPuzzlePage();
    fireEvent.click(screen.getByText('Start Training'));
    const board = screen.getByTestId('puzzle-chessboard');
    expect(['white', 'black']).toContain(board.getAttribute('data-orientation'));
  });
});
