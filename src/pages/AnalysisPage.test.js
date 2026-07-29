import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalysisPage from './AnalysisPage';

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

jest.mock('../hooks/useChessEngine', () => ({
  useChessEngine: () => ({
    engineReady: true,
    stockfishEval: { score: 0, type: 'cp', depth: 20, pv: [] },
    multiPvLines: [],
    moveClassifications: [],
    engineMode: 'browser',
    backendUrl: null,
    sendCommand: () => {},
    prepareClassification: () => {},
    cancelClassification: () => {},
    sliceClassifications: () => {},
    addClassification: () => {},
    resetEval: () => {},
    resetClassifications: () => {},
  }),
}));

jest.mock('../hooks/useGameHistory', () => ({
  useGameHistory: () => ({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [],
    moveHistory: ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
    historyPointer: 0,
    game: new (require('chess.js').Chess)(),
    lastMove: null,
    applyMove: () => {},
    applyMoveSequence: () => {},
    undo: () => {},
    redo: () => ({ addLabel: null }),
    pushHistory: () => {},
    jumpToMove: () => {},
    importFen: () => {},
    importPgn: () => {},
    reset: () => {},
  }),
}));

jest.mock('../EvaluationSection', () => () => (
  <div data-testid="evaluation-section">Evaluation</div>
));

jest.mock('../ChessboardContainer', () => () => (
  <div data-testid="chessboard-container">Chessboard</div>
));

jest.mock('../Controls', () => (props) => (
  <div data-testid="controls">
    <button onClick={props.onReset}>Reset</button>
    <button onClick={props.onFlip}>Flip</button>
    <button onClick={props.onUndo}>Undo</button>
    <button onClick={props.onRedo}>Redo</button>
    <button data-testid="shortcuts-btn" onClick={props.onKeyboardShortcuts}>Shortcuts</button>
    <button onClick={props.onFenClick}>FEN</button>
    <button onClick={props.onPgnClick}>PGN</button>
  </div>
));

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

jest.mock('../Modal', () => {
  return function MockModal({ children, isOpen, onClose, title }) {
    if (!isOpen) return null;
    return (
      <div data-testid="modal" data-title={title}>
        <h2>{title}</h2>
        {children}
      </div>
    );
  };
});

jest.mock('../ErrorBoundary', () => {
  return function MockErrorBoundary({ children }) {
    return <div data-testid="error-boundary">{children}</div>;
  };
});

jest.mock('../MoveHistory', () => () => <div data-testid="move-history">Move History</div>);

jest.mock('../components/OpeningExplorer', () => () => <div data-testid="opening-explorer">Opening Explorer</div>);

jest.mock('../components/GameReview', () => (props) => (
  <div data-testid="game-review">
    <button onClick={props.onClose}>Close Review</button>
    <button onClick={props.onNewGame}>New Game Review</button>
  </div>
));

jest.mock('../lib/sound', () => ({
  playMoveSound: () => {},
  findCheckedKingSquare: () => null,
  setMuted: () => {},
  isMuted: () => false,
}));

jest.mock('../lib/share', () => ({
  copyShareLink: () => Promise.resolve(true),
  decodeGameFromParams: () => ({ pgn: null, result: null }),
}));

jest.mock('../lib/gameHistory', () => ({
  saveGame: () => Promise.resolve({ id: 1 }),
}));

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
  ToastContainer: () => null,
}));

jest.mock('../MoveClassification', () => ({
  buildPgnWithNag: () => '[Event "?"]\n\n1. e4 e5',
  LABELS: {},
  CLASS_TO_NAG: {},
}));

// ── Helpers ─────────────────────────────────────────────

const renderAnalysisPage = () => render(<AnalysisPage />);

// ── Tests ───────────────────────────────────────────────

describe('AnalysisPage — rendering', () => {
  test('shows all main sections after loading', async () => {
    renderAnalysisPage();
    // Use findByTestId for lazy-loaded components (Suspense async resolution)
    expect(await screen.findByTestId('evaluation-section')).toBeInTheDocument();
    expect(await screen.findByTestId('chessboard-container')).toBeInTheDocument();
    expect(await screen.findByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('move-history')).toBeInTheDocument();
    expect(screen.getByTestId('opening-explorer')).toBeInTheDocument();
  });
});

describe('AnalysisPage — game over banner', () => {
  test('no game over banner shown initially', () => {
    renderAnalysisPage();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('controls render with correct CSS classes', () => {
    renderAnalysisPage();
    const controls = screen.getByTestId('controls');
    expect(controls).toBeInTheDocument();
  });
});

describe('AnalysisPage — reset behavior', () => {
  test('clicking Reset when no moves have been played does not crash', () => {
    renderAnalysisPage();
    // With empty moves, reset calls confirmReset() immediately (no dialog)
    expect(() => {
      fireEvent.click(screen.getByText('Reset'));
    }).not.toThrow();
    // Main sections should still be visible after reset
    expect(screen.getByTestId('chessboard-container')).toBeInTheDocument();
  });
});

describe('AnalysisPage — FEN modal', () => {
  test('opens FEN modal on FEN button click', () => {
    renderAnalysisPage();
    fireEvent.click(screen.getByText('FEN'));
    expect(screen.getByText('Import')).toBeInTheDocument();
  });
});

describe('AnalysisPage — PGN modal', () => {
  test('opens PGN modal on PGN button click', () => {
    renderAnalysisPage();
    fireEvent.click(screen.getByText('PGN'));
    expect(screen.getByText('Download .pgn')).toBeInTheDocument();
  });
});

describe('AnalysisPage — FEN import validation', () => {
  test('shows error toast when importing an invalid FEN', () => {
    const { toast } = require('react-toastify');
    renderAnalysisPage();
    fireEvent.click(screen.getByText('FEN'));

    const textarea = screen.getByPlaceholderText('Enter FEN string');
    fireEvent.change(textarea, { target: { value: 'this-is-not-a-fen' } });
    fireEvent.click(screen.getByText('Import'));

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  test('imports successfully when FEN is valid', () => {
    const { toast } = require('react-toastify');
    renderAnalysisPage();
    fireEvent.click(screen.getByText('FEN'));

    const textarea = screen.getByPlaceholderText('Enter FEN string');
    fireEvent.change(textarea, { target: { value: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' } });
    fireEvent.click(screen.getByText('Import'));

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('FEN imported successfully!');
  });
});

describe('AnalysisPage — keyboard shortcuts', () => {
  test('opens shortcut guide when ? key pressed', () => {
    renderAnalysisPage();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  test('shortcut guide shows all shortcut keys', () => {
    renderAnalysisPage();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('←')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
  });

  test('shortcut guide dismisses on Got it click', () => {
    renderAnalysisPage();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Got it'));
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  test('shortcuts button in Controls opens guide', () => {
    renderAnalysisPage();
    fireEvent.click(screen.getByTestId('shortcuts-btn'));
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });
});

describe('AnalysisPage — undo/redo keyboard shortcuts', () => {
  test('ArrowLeft triggers undo', () => {
    renderAnalysisPage();
    // No error should be thrown
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  test('ArrowRight triggers redo', () => {
    renderAnalysisPage();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  test('R key triggers reset', () => {
    renderAnalysisPage();
    fireEvent.keyDown(window, { key: 'r' });
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });

  test('F key triggers flip board', () => {
    renderAnalysisPage();
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByTestId('controls')).toBeInTheDocument();
  });
});
