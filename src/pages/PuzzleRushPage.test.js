import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import PuzzleRushPage from './PuzzleRushPage';

// ── Module-level mocks ──
jest.mock('../hooks/useLoadingSequence', () => ({
  useLoadingSequence: () => ({
    isLoading: false,
    showSkeleton: false,
    stepIndex: 3,
    markReady: () => {},
  }),
}));

jest.mock('../ChessboardContainer', () => {
  return function MockChessboard({ fen, onDrop, boardOrientation, isSpectator }) {
    return (
      <div data-testid="rush-chessboard" data-fen={fen} data-orientation={boardOrientation} data-spectator={String(isSpectator)}>
        <button
          data-testid="mock-drop"
          onClick={() => onDrop({ sourceSquare: 'd2', targetSquare: 'd3' })}
        >
          Drop (d2→d3)
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

const samplePuzzle = {
  id: 1,
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  moves: ['Nd5', 'Nxd5', 'Bxd5'],
  rating: 1200,
  themes: ['Fork', 'Center'],
  description: 'White to play — exploit the loose knight on c6.',
};

jest.mock('../data/puzzles', () => ({
  getRandomPuzzle: () => ({ ...samplePuzzle }),
}));

jest.mock('../lib/sound', () => ({
  playMoveSound: () => {},
}));

jest.mock('react-toastify', () => ({
  toast: {
    success: () => {},
    error: () => {},
    info: () => {},
  },
  ToastContainer: () => null,
}));

jest.mock('react-feather', () => ({
  ChevronRight: () => <span data-testid="icon-chevron-right" />,
  Zap: () => <span data-testid="icon-zap" />,
  Heart: () => <span data-testid="icon-heart" />,
  Clock: () => <span data-testid="icon-clock" />,
  RotateCcw: () => <span data-testid="icon-rotate" />,
  Award: () => <span data-testid="icon-award" />,
}));

const renderPage = () => render(<PuzzleRushPage />);

// Advance through the countdown (3→2→1→0→playing).
// Must use separate act() calls per tick so React re-renders between each timer,
// otherwise the useEffect never sees the updated countdownValue to schedule the next tick.
const finishCountdown = () => {
  act(() => jest.advanceTimersByTime(800)); // 3→2, re-render
  act(() => jest.advanceTimersByTime(800)); // 2→1, re-render
  act(() => jest.advanceTimersByTime(800)); // 1→0, re-render → phase=playing
};

// ── Tests ──
describe('PuzzleRushPage — start screen', () => {
  test('renders with title', () => {
    renderPage();
    expect(screen.getByText('Puzzle Rush')).toBeInTheDocument();
  });

  test('shows time control presets', () => {
    renderPage();
    expect(screen.getByText('15s')).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
    expect(screen.getByText('60s')).toBeInTheDocument();
  });

  test('30s is selected by default', () => {
    renderPage();
    expect(screen.getByText('30s').className).toContain('active');
  });

  test('can switch time control', () => {
    renderPage();
    fireEvent.click(screen.getByText('15s'));
    expect(screen.getByText('15s').className).toContain('active');
  });

  test('has Start Rush button', () => {
    renderPage();
    expect(screen.getByText('Start Rush')).toBeInTheDocument();
  });

  test('shows rules', () => {
    renderPage();
    expect(screen.getByText(/3 lives/)).toBeInTheDocument();
    expect(screen.getByText(/Streak bonuses/)).toBeInTheDocument();
    expect(screen.getByText(/Beat the clock/)).toBeInTheDocument();
  });
});

describe('PuzzleRushPage — countdown', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { act(() => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

  test('shows 3 after clicking start', () => {
    renderPage();
    fireEvent.click(screen.getByText('Start Rush'));
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('advances to 2', () => {
    renderPage();
    fireEvent.click(screen.getByText('Start Rush'));
    act(() => jest.advanceTimersByTime(800));
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('PuzzleRushPage — gameplay', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { act(() => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

  test('board renders after countdown', () => {
    renderPage();
    fireEvent.click(screen.getByText('Start Rush'));
    finishCountdown();
    expect(screen.getByTestId('rush-chessboard')).toBeInTheDocument();
  });

  test('puzzle description visible', () => {
    renderPage();
    fireEvent.click(screen.getByText('Start Rush'));
    finishCountdown();
    expect(screen.getByText(samplePuzzle.description)).toBeInTheDocument();
  });

  test('solution panel visible', () => {
    renderPage();
    fireEvent.click(screen.getByText('Start Rush'));
    finishCountdown();
    expect(screen.getByText('Solution')).toBeInTheDocument();
  });

  test('progress indicator visible', () => {
    renderPage();
    fireEvent.click(screen.getByText('Start Rush'));
    finishCountdown();
    expect(screen.getByText('Puzzle 1/20')).toBeInTheDocument();
  });

  test('board orientation is white for this puzzle', () => {
    renderPage();
    fireEvent.click(screen.getByText('Start Rush'));
    finishCountdown();
    expect(screen.getByTestId('rush-chessboard').getAttribute('data-orientation')).toBe('white');
  });
});

describe('PuzzleRushPage — wrong moves & game over', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { act(() => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

  test('three wrong moves end the game', () => {
    renderPage();
    fireEvent.click(screen.getByText('Start Rush'));
    finishCountdown();

    fireEvent.click(screen.getByTestId('mock-drop')); // 2 lives
    fireEvent.click(screen.getByTestId('mock-drop')); // 1 life
    fireEvent.click(screen.getByTestId('mock-drop')); // 0 lives → game over

    expect(screen.getByText('Game Over')).toBeInTheDocument();
  });

  test('end screen shows Play Again', () => {
    renderPage();
    fireEvent.click(screen.getByText('Start Rush'));
    finishCountdown();

    fireEvent.click(screen.getByTestId('mock-drop'));
    fireEvent.click(screen.getByTestId('mock-drop'));
    fireEvent.click(screen.getByTestId('mock-drop'));

    expect(screen.getByText('Play Again')).toBeInTheDocument();
  });
});
