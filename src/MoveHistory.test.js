import React from 'react';
import { render, screen } from '@testing-library/react';
import MoveHistory from './MoveHistory';

jest.mock('./lib/openings', () => ({
  detectOpening: () => ({ name: 'Ruy Lopez', eco: 'C80' }),
  getCommonNextMoves: () => [{ move: 'Nc6' }, { move: 'Nf6' }],
}));

const sampleClassifications = [
  { label: 'Good', icon: '', color: '#9E9E9E' },
  { label: 'Good', icon: '', color: '#9E9E9E' },
  { label: 'Excellent', icon: '✓', color: '#81C784' },
  { label: 'Excellent', icon: '✓', color: '#81C784' },
];

describe('MoveHistory — ARIA', () => {
  test('renders move tree as a table', () => {
    render(
      <MoveHistory
        moves={['e4', 'e5', 'Nf3', 'Nc6']}
        classifications={sampleClassifications}
        currentMoveIndex={0}
      />
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(3);
  });

  test('clickable move cells are buttons with descriptive labels', () => {
    render(
      <MoveHistory
        moves={['e4', 'e5', 'Nf3', 'Nc6']}
        classifications={sampleClassifications}
        currentMoveIndex={-1}
      />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-label');
    });
  });

  test('search input has accessible label', () => {
    render(
      <MoveHistory
        moves={['e4', 'e5', 'Nf3', 'Nc6']}
        classifications={sampleClassifications}
      />
    );
    expect(screen.getByLabelText('Search moves')).toBeInTheDocument();
  });
});
