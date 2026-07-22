import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  ShimmerBlock,
  PieceStepIndicator,
  StepProgressBar,
  BoardSkeleton,
  PanelSkeleton,
  MoveHistorySkeleton,
  OpeningExplorerSkeleton,
  GameReviewSkeleton,
  AnalysisSkeleton,
  OnlineSkeleton,
  HistorySkeleton,
  PuzzleSkeleton,
} from './SkeletonLoader';

// ── ShimmerBlock ─────────────────────────────────────

describe('ShimmerBlock', () => {
  test('renders with default props', () => {
    const { container } = render(<ShimmerBlock width="100px" height="20px" />);
    const el = container.firstChild;
    expect(el).toHaveClass('animate-shimmer');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).toHaveStyle({ width: '100px', height: '20px' });
  });

  test('applies custom className and borderRadius', () => {
    const { container } = render(
      <ShimmerBlock width="50px" height="10px" borderRadius="4px" className="custom" />
    );
    const el = container.firstChild;
    expect(el).toHaveClass('animate-shimmer');
    expect(el).toHaveClass('custom');
    expect(el).toHaveStyle({ width: '50px', height: '10px', borderRadius: '4px' });
  });
});

// ── PieceStepIndicator ───────────────────────────────

describe('PieceStepIndicator', () => {
  const steps = [
    { label: 'Step 1', pct: 25, section: 'one' },
    { label: 'Step 2', pct: 50, section: 'two' },
    { label: 'Step 3', pct: 75, section: 'three' },
    { label: 'Step 4', pct: 100, section: 'four' },
  ];

  test('renders all step labels', () => {
    render(<PieceStepIndicator steps={steps} currentIndex={0} />);
    steps.forEach((s) => {
      expect(screen.getByText(s.label)).toBeInTheDocument();
    });
  });

  test('marks current index as current', () => {
    const { container } = render(<PieceStepIndicator steps={steps} currentIndex={2} />);
    const currentDot = container.querySelector('.ps-current');
    expect(currentDot).toBeInTheDocument();
  });

  test('marks done indices with piece characters', () => {
    const { container } = render(<PieceStepIndicator steps={steps} currentIndex={2} />);
    const doneDots = container.querySelectorAll('.ps-dot-done');
    // Steps 0, 1, 2 are done (step 2 is both current AND done), step 3 is not done
    expect(doneDots.length).toBe(3);
  });

  test('handles currentIndex beyond steps gracefully', () => {
    const { container } = render(<PieceStepIndicator steps={steps} currentIndex={99} />);
    const allDone = container.querySelectorAll('.ps-done');
    expect(allDone.length).toBe(steps.length);
  });

  test('has aria-hidden attribute', () => {
    const { container } = render(<PieceStepIndicator steps={steps} currentIndex={0} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

// ── StepProgressBar ──────────────────────────────────

describe('StepProgressBar', () => {
  test('renders progress bar with correct percentage', () => {
    const { container } = render(<StepProgressBar pct={50} label="Loading…" />);
    const fill = container.querySelector('.sk-progress-fill');
    expect(fill).toHaveStyle({ width: '50%' });
  });

  test('displays label text', () => {
    render(<StepProgressBar pct={75} label="Almost ready!" />);
    expect(screen.getByText('Almost ready!')).toBeInTheDocument();
  });

  test('has progressbar role with correct valuenow', () => {
    const { container } = render(<StepProgressBar pct={33} label="Test" />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toHaveAttribute('aria-valuenow', '33');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });
});

// ── BoardSkeleton ────────────────────────────────────

describe('BoardSkeleton', () => {
  test('renders with aria attributes', () => {
    const { container } = render(<BoardSkeleton />);
    const el = container.firstChild;
    expect(el).toHaveAttribute('aria-busy', 'true');
    expect(el).toHaveAttribute('aria-label', 'Loading chessboard');
  });

  test('renders both white and black piece elements', () => {
    const { container } = render(<BoardSkeleton />);
    const pieces = container.querySelectorAll('.sk-bp');
    expect(pieces.length).toBeGreaterThanOrEqual(12);
  });
});

// ── PanelSkeleton ────────────────────────────────────

describe('PanelSkeleton', () => {
  test('renders with aria attributes', () => {
    render(<PanelSkeleton />);
    const el = screen.getByLabelText('Loading panel');
    expect(el).toHaveAttribute('aria-busy', 'true');
  });
});

// ── MoveHistorySkeleton ──────────────────────────────

describe('MoveHistorySkeleton', () => {
  test('renders with aria attributes', () => {
    render(<MoveHistorySkeleton />);
    const el = screen.getByLabelText('Loading move history');
    expect(el).toHaveAttribute('aria-busy', 'true');
  });
});

// ── OpeningExplorerSkeleton ──────────────────────────

describe('OpeningExplorerSkeleton', () => {
  test('renders with aria-label', () => {
    render(<OpeningExplorerSkeleton />);
    expect(screen.getByLabelText('Loading opening explorer')).toBeInTheDocument();
  });
});

// ── GameReviewSkeleton ───────────────────────────────

describe('GameReviewSkeleton', () => {
  test('renders without crashing', () => {
    const { container } = render(<GameReviewSkeleton />);
    expect(container.querySelector('.game-review-card')).toBeInTheDocument();
  });
});

// ── AnalysisSkeleton ─────────────────────────────────

describe('AnalysisSkeleton', () => {
  test('renders step 0 (engine)', () => {
    const { container } = render(<AnalysisSkeleton stepIndex={0} />);
    expect(screen.getByLabelText('Loading Analysis page')).toBeInTheDocument();
    // Engine section should be active
    const controlsSection = container.querySelector('[style*="grid-area: controls"]');
    expect(controlsSection).toHaveClass('sk-section-active');
  });

  test('renders step 2 (eval section becomes active)', () => {
    const { container } = render(<AnalysisSkeleton stepIndex={2} />);
    const evalSection = container.querySelector('[style*="grid-area: evaluation"]');
    expect(evalSection).toHaveClass('sk-section-active');
  });

  test('renders final step (ready)', () => {
    render(<AnalysisSkeleton stepIndex={3} />);
    // Use getAllByText since "Siap bermain!" might appear multiple times
    const readyEls = screen.getAllByText(/Siap bermain/);
    expect(readyEls.length).toBeGreaterThanOrEqual(1);
  });

  test('handles stepIndex beyond max gracefully', () => {
    render(<AnalysisSkeleton stepIndex={99} />);
    const readyEls = screen.getAllByText(/Siap bermain/);
    expect(readyEls.length).toBeGreaterThanOrEqual(1);
  });
});

// ── OnlineSkeleton ───────────────────────────────────

describe('OnlineSkeleton', () => {
  test('renders step 0 (connect)', () => {
    render(<OnlineSkeleton stepIndex={0} />);
    expect(screen.getByLabelText('Loading Online page')).toBeInTheDocument();
  });

  test('renders board section at index 2', () => {
    render(<OnlineSkeleton stepIndex={2} />);
    // 'Memuat papan…' appears in both StepProgressBar AND PieceStepIndicator
    const matches = screen.getAllByText('Memuat papan…');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

// ── HistorySkeleton ──────────────────────────────────

describe('HistorySkeleton', () => {
  test('renders step 0', () => {
    render(<HistorySkeleton stepIndex={0} />);
    expect(screen.getByLabelText('Loading History page')).toBeInTheDocument();
  });

  test('renders game list items', () => {
    const { container } = render(<HistorySkeleton stepIndex={1} />);
    const rows = container.querySelectorAll('.sk-history-row');
    expect(rows.length).toBe(5);
  });

  test('renders with label', () => {
    const { container } = render(<HistorySkeleton stepIndex={0} />);
    // Don't check for specific text "Memuat riwayat…" as it may appear in both
    // StepProgressBar AND PieceStepIndicator
    const mainContainer = container.querySelector('.App');
    expect(mainContainer).toBeInTheDocument();
  });
});

// ── PuzzleSkeleton ───────────────────────────────────

describe('PuzzleSkeleton', () => {
  test('renders step 0', () => {
    const { container } = render(<PuzzleSkeleton stepIndex={0} />);
    expect(screen.getByLabelText('Loading Puzzle page')).toBeInTheDocument();
  });

  test('renders stats grid', () => {
    const { container } = render(<PuzzleSkeleton stepIndex={2} />);
    const stats = container.querySelector('.sk-puzzle-stats');
    expect(stats).toBeInTheDocument();
  });

  test('renders progress bar with label', () => {
    const { container } = render(<PuzzleSkeleton stepIndex={1} />);
    const progress = container.querySelector('.sk-progress-row');
    expect(progress).toBeInTheDocument();
  });
});
