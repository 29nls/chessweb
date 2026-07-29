import React from 'react';
import { render, screen } from '@testing-library/react';
import OpeningExplorer from './OpeningExplorer';

jest.mock('../lib/openings', () => ({
  detectOpening: (moves) => (moves.length > 0 ? { name: 'Ruy Lopez', eco: 'C80' } : null),
  getCommonNextMoves: () => [
    { move: 'O-O', count: 120 },
    { move: 'd4', count: 85 },
  ],
}));

describe('OpeningExplorer — ARIA', () => {
  test('SVG icon is decorative and hidden from screen readers', () => {
    render(<OpeningExplorer moves={['e4', 'e5', 'Nf3']} />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  test('renders opening name in a polite live region', () => {
    render(<OpeningExplorer moves={['e4', 'e5', 'Nf3']} />);
    const liveRegion = screen.getByText('Ruy Lopez').parentElement;
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  test('common next moves are exposed as a list', () => {
    render(<OpeningExplorer moves={['e4', 'e5', 'Nf3']} />);
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });
});
