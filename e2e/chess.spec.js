import { test, expect } from '@playwright/test';

// Note: the engine is the in-browser Stockfish WASM (lite single build), which
// needs no SharedArrayBuffer, so it runs fine in headless Chromium.

test('app loads with board and controls', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'ChessWeb' })).toBeVisible();
  await expect(page.getByTestId('chessboard')).toBeVisible();
  await expect(page.getByText('Auto-move Opponent')).toBeVisible();
});

test('importing a position triggers the engine auto-move', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'ChessWeb' })).toBeVisible();

  // Turn on the opponent engine.
  await page.getByText('Auto-move Opponent').click();

  // Open the FEN modal and load a position where it is Black to move
  // (the opponent), so the auto-move pipeline runs end-to-end.
  await page.getByRole('button', { name: 'FEN' }).click();
  await page.getByPlaceholder('Enter FEN string')
    .fill('rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
  await page.getByRole('button', { name: 'Import' }).click();

  // The engine replies with exactly one (opponent) move -> one move-san entry.
  await expect(page.getByTestId('move-san')).toHaveCount(1, { timeout: 15000 });
});
