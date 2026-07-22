import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GameReview from './GameReview';

// ── Mocks ──────────────────────────────────────────────
// IMPORTANT: jest.mock factory functions are hoisted above imports and
// CANNOT reference variables from the outer scope (const/let).

jest.mock('../AccessibleDialog', () => {
  return function MockDialog({ children, isOpen, onClose, labelledBy, className }) {
    if (!isOpen) return null;
    return (
      <div data-testid="accessible-dialog" data-labelledby={labelledBy} className={className}>
        {children}
      </div>
    );
  };
});

jest.mock('../MoveClassification', () => ({
  computeAccuracyReport: () => ({
    white: { accuracy: 85, counts: { Best: 3, Excellent: 2, Good: 1 }, moves: 6 },
    black: { accuracy: 72, counts: { Best: 2, Good: 2, Inaccuracy: 1, Mistake: 1 }, moves: 6 },
  }),
  LABELS: {
    BRILLIANT: { label: 'Brilliant', icon: '‼', color: '#4FC3F7' },
    BEST: { label: 'Best', icon: '★', color: '#43A047' },
    GREAT: { label: 'Great', icon: '!', color: '#66BB6A' },
    EXCELLENT: { label: 'Excellent', icon: '✓', color: '#81C784' },
    GOOD: { label: 'Good', icon: '', color: '#9E9E9E' },
    INACCURACY: { label: 'Inaccuracy', icon: '?!', color: '#FFA726' },
    MISS: { label: 'Miss', icon: '?!?', color: '#FF7043' },
    MISTAKE: { label: 'Mistake', icon: '?', color: '#EF5350' },
    BLUNDER: { label: 'Blunder', icon: '??', color: '#E53935' },
  },
}));

jest.mock('./SkeletonLoader', () => ({
  GameReviewSkeleton: () => <div data-testid="game-review-skeleton" />,
}));

// ── Helpers ─────────────────────────────────────────────

const sampleClassifications = [
  { label: 'Best', icon: '★', color: '#43A047' },
  { label: 'Excellent', icon: '✓', color: '#81C784' },
  { label: 'Best', icon: '★', color: '#43A047' },
  { label: 'Good', icon: '', color: '#9E9E9E' },
];

const sampleMoves = ['e4', 'e5', 'Nf3', 'Nc6'];

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onNewGame: jest.fn(),
  classifications: sampleClassifications,
  moves: sampleMoves,
  result: { winner: 'white', reason: 'Checkmate' },
};

const renderGameReview = (overrides = {}) => {
  const props = { ...defaultProps, ...overrides };
  return render(<GameReview {...props} />);
};

// ── Tests ───────────────────────────────────────────────

describe('GameReview — loading / empty state', () => {
  test('returns null when not open and no classifications', () => {
    const { container } = render(
      <GameReview isOpen={false} onClose={jest.fn()} onNewGame={jest.fn()} classifications={[]} moves={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('shows skeleton when open but no classifications', () => {
    renderGameReview({ classifications: [], moves: [] });
    expect(screen.getByTestId('game-review-skeleton')).toBeInTheDocument();
  });
});

describe('GameReview — rendering with classifications', () => {
  test('renders the game review title', () => {
    renderGameReview();
    expect(screen.getByText('Game Review')).toBeInTheDocument();
  });

  test('shows "White wins!" when white wins by checkmate', () => {
    renderGameReview({ result: { winner: 'white', reason: 'Checkmate' } });
    expect(screen.getByText('White wins!')).toBeInTheDocument();
  });

  test('shows "Black wins!" when black wins', () => {
    renderGameReview({ result: { winner: 'black', reason: 'Checkmate' } });
    expect(screen.getByText('Black wins!')).toBeInTheDocument();
  });

  test('shows draw text for draw result', () => {
    renderGameReview({ result: { winner: 'draw', reason: 'Stalemate' } });
    expect(screen.getByText('Game ended in a draw')).toBeInTheDocument();
  });

  test('shows default text when game is complete but no result', () => {
    renderGameReview({ result: null });
    expect(screen.getByText('Game complete')).toBeInTheDocument();
  });

  test('renders accuracy cards for both sides', () => {
    renderGameReview();
    // "White" appears in both accuracy card AND breakdown section — use getAllByText
    const whiteElements = screen.getAllByText('White');
    expect(whiteElements.length).toBeGreaterThanOrEqual(1);
    const blackElements = screen.getAllByText('Black');
    expect(blackElements.length).toBeGreaterThanOrEqual(1);
  });

  test('renders accuracy percentages', () => {
    renderGameReview();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  test('renders move breakdown counts', () => {
    renderGameReview();
    expect(screen.getByText('Move Breakdown')).toBeInTheDocument();
    // "Best" appears multiple times — use getAllByText
    const bestElements = screen.getAllByText('Best');
    expect(bestElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Inaccuracy')).toBeInTheDocument();
  });
});

describe('GameReview — interactive elements', () => {
  test('calls onClose when Close button clicked', () => {
    const onClose = jest.fn();
    renderGameReview({ onClose });
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('calls onNewGame when New Game button clicked', () => {
    const onNewGame = jest.fn();
    renderGameReview({ onNewGame });
    fireEvent.click(screen.getByText('New Game'));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  test('renders both action buttons', () => {
    renderGameReview();
    expect(screen.getByText('Close')).toBeInTheDocument();
    expect(screen.getByText('New Game')).toBeInTheDocument();
  });
});

describe('GameReview — winner badge in accuracy card', () => {
  test('shows (Winner) tag on White card when white wins', () => {
    renderGameReview({ result: { winner: 'white', reason: 'Checkmate' } });
    // The accuracy card renders "White (Winner)" in one element
    expect(screen.getByText(/White.*Winner/)).toBeInTheDocument();
  });

  test('shows (Winner) tag on Black card when black wins', () => {
    renderGameReview({ result: { winner: 'black', reason: 'Checkmate' } });
    expect(screen.getByText(/Black.*Winner/)).toBeInTheDocument();
  });

  test('does not show (Winner) tag on draw', () => {
    renderGameReview({ result: { winner: 'draw', reason: 'Draw' } });
    const whiteLabels = screen.getAllByText('White');
    // None should contain "Winner"
    whiteLabels.forEach(el => {
      expect(el).not.toHaveTextContent(/Winner/);
    });
  });
});
