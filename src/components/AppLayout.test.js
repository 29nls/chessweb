import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppLayout from './AppLayout';

describe('AppLayout — accessibility', () => {
  test('renders a skip-to-content link that points to main content', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <div data-testid="page-content">Page content</div>
        </AppLayout>
      </MemoryRouter>
    );

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('main content container has the id that the skip link targets', () => {
    render(
      <MemoryRouter>
        <AppLayout>
          <div data-testid="page-content">Page content</div>
        </AppLayout>
      </MemoryRouter>
    );

    const main = document.getElementById('main-content');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('tabIndex', '-1');
  });
});
