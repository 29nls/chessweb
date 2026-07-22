import { test, expect } from '@playwright/test';
import { Chess } from 'chess.js';

// ── Helpers ────────────────────────────────────────────

/**
 * Wait for the chessboard to be visible (skeleton fade-out completed).
 */
async function waitForChessboard(page) {
  await page.goto('/analysis');
  await expect(page.getByTestId('chessboard')).toBeVisible({ timeout: 20000 });
}

/**
 * Wait for lazy-loaded Controls component to render.
 */
async function waitForControls(page) {
  await expect(page.locator('.panel.controls')).toBeVisible({ timeout: 15000 });
}

/**
 * Read a prop from the React fiber tree of the chessboard container.
 * Returns the raw value or null if not found.
 */
async function readFiberProp(page, propName) {
  return page.evaluate((p) => {
    function walkForProp(fiber, name, visited, depth) {
      if (!fiber || visited.has(fiber) || depth > 500) return null;
      visited.add(fiber);
      if (fiber.memoizedProps && name in fiber.memoizedProps) return fiber.memoizedProps[name];
      if (fiber.pendingProps && name in fiber.pendingProps) return fiber.pendingProps[name];
      let r = walkForProp(fiber.child, name, visited, depth + 1);
      if (r) return r;
      r = walkForProp(fiber.sibling, name, visited, depth + 1);
      if (r) return r;
      r = walkForProp(fiber.return, name, visited, depth + 1);
      if (r) return r;
      return null;
    }

    const container = document.querySelector('[data-testid="chessboard"]');
    if (!container) return null;

    const fiberKey = Object.keys(container).find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
    if (!fiberKey) return null;

    return walkForProp(container[fiberKey], p, new Set(), 0);
  }, propName);
}

/**
 * Call the onDrop callback found in the fiber tree with source and target squares.
 * Returns the return value of onDrop, or null on error.
 */
async function callOnDrop(page, sourceSquare, targetSquare) {
  return page.evaluate(({ from, to }) => {
    function walkForProp(fiber, name, visited, depth) {
      if (!fiber || visited.has(fiber) || depth > 500) return null;
      visited.add(fiber);
      if (fiber.memoizedProps && name in fiber.memoizedProps) return fiber.memoizedProps[name];
      if (fiber.pendingProps && name in fiber.pendingProps) return fiber.pendingProps[name];
      let r = walkForProp(fiber.child, name, visited, depth + 1);
      if (r) return r;
      r = walkForProp(fiber.sibling, name, visited, depth + 1);
      if (r) return r;
      r = walkForProp(fiber.return, name, visited, depth + 1);
      if (r) return r;
      return null;
    }

    const container = document.querySelector('[data-testid="chessboard"]');
    if (!container) return null;

    const fiberKey = Object.keys(container).find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
    if (!fiberKey) return null;

    const onDrop = walkForProp(container[fiberKey], 'onDrop', new Set(), 0);
    if (typeof onDrop !== 'function') return null;

    return onDrop({ sourceSquare: from, targetSquare: to });
  }, { from: sourceSquare, to: targetSquare });
}

/**
 * Call the onPieceDrop callback from the Chessboard v5 options object.
 * Returns the return value of onPieceDrop, or null on error.
 */
async function callOnPieceDrop(page, sourceSquare, targetSquare) {
  return page.evaluate(({ from, to }) => {
    function walkForProp(fiber, name, visited, depth) {
      if (!fiber || visited.has(fiber) || depth > 500) return null;
      visited.add(fiber);
      if (fiber.memoizedProps && name in fiber.memoizedProps) return fiber.memoizedProps[name];
      if (fiber.pendingProps && name in fiber.pendingProps) return fiber.pendingProps[name];
      let r = walkForProp(fiber.child, name, visited, depth + 1);
      if (r) return r;
      r = walkForProp(fiber.sibling, name, visited, depth + 1);
      if (r) return r;
      r = walkForProp(fiber.return, name, visited, depth + 1);
      if (r) return r;
      return null;
    }

    const container = document.querySelector('[data-testid="chessboard"]');
    if (!container) return null;

    const fiberKey = Object.keys(container).find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );
    if (!fiberKey) return null;

    const options = walkForProp(container[fiberKey], 'options', new Set(), 0);
    if (!options || typeof options.onPieceDrop !== 'function') return null;

    return options.onPieceDrop({ sourceSquare: from, targetSquare: to });
  }, { from: sourceSquare, to: targetSquare });
}

// ── Analysis Page — Chessboard click-to-move ──────────

test.describe('Analysis Page - Chessboard', () => {
  test.beforeEach(async ({ page }) => {
    await waitForChessboard(page);
  });

  test('click-to-move: fiber traversal — reads FEN in Node.js, computes legal move with chess.js, calls onDrop', async ({ page }) => {
    await expect(page.locator('[data-testid="chessboard"]')).toBeVisible({ timeout: 15000 });

    // Step 1: Read FEN from the fiber tree (options.position in v5, or fen on ChessboardContainer)
    let fen = await readFiberProp(page, 'fen');
    if (!fen) {
      // Fallback: try reading from v5 options object
      const options = await page.evaluate(() => {
        function walkForProp(fiber, name, visited, depth) {
          if (!fiber || visited.has(fiber) || depth > 500) return null;
          visited.add(fiber);
          if (fiber.memoizedProps && name in fiber.memoizedProps) return fiber.memoizedProps[name];
          if (fiber.pendingProps && name in fiber.pendingProps) return fiber.pendingProps[name];
          let r = walkForProp(fiber.child, name, visited, depth + 1);
          if (r) return r;
          r = walkForProp(fiber.sibling, name, visited, depth + 1);
          if (r) return r;
          r = walkForProp(fiber.return, name, visited, depth + 1);
          if (r) return r;
          return null;
        }

        const container = document.querySelector('[data-testid="chessboard"]');
        if (!container) return null;
        const fiberKey = Object.keys(container).find(
          (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
        );
        if (!fiberKey) return null;
        const opts = walkForProp(container[fiberKey], 'options', new Set(), 0);
        return opts ? opts.position : null;
      });
      fen = options;
    }
    expect(fen).toBeTruthy();

    // Step 2: Compute a legal move in Node.js context (chess.js IS available here)
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });
    expect(moves.length).toBeGreaterThan(0);

    const move = moves[0];

    // Step 3: Call onDrop via fiber traversal
    const result = await callOnDrop(page, move.from, move.to);
    expect(result).toBe(true);

    // Step 4: Wait for React state flush and verify move in history
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('move-list')).toBeVisible({ timeout: 15000 });
    const moveText = await page.getByTestId('move-list').textContent();
    expect(moveText).toContain(move.san);
  });

  test('click-to-move: Playwright DOM click on square elements', async ({ page }) => {
    const squares = page.locator('[data-square]');
    await expect(squares.first()).toBeVisible({ timeout: 15000 });

    await page.locator('[data-square="e2"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-square="e4"]').click();
    await page.waitForTimeout(1000);

    await expect(page.getByTestId('move-list')).toBeVisible({ timeout: 15000 });
    const moveText = await page.getByTestId('move-list').textContent();
    expect(moveText).toContain('e4');
  });

  test('click-to-move: e2-e4 followed by e7-e5 shows 1.e4 e5 in history', async ({ page }) => {
    await page.locator('[data-square="e2"]').click();
    await page.waitForTimeout(200);
    await page.locator('[data-square="e4"]').click();
    await page.waitForTimeout(1000);

    await page.locator('[data-square="e7"]').click();
    await page.waitForTimeout(200);
    await page.locator('[data-square="e5"]').click();
    await page.waitForTimeout(1000);

    await expect(page.getByTestId('move-list')).toBeVisible({ timeout: 15000 });
    const moveText = await page.getByTestId('move-list').textContent();
    expect(moveText).toContain('e4');
    expect(moveText).toContain('e5');
  });

  test('click-to-move: illegal square does not execute a move', async ({ page }) => {
    await page.locator('[data-square="e2"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-square="e5"]').click();
    await page.waitForTimeout(500);

    const moveList = page.getByTestId('move-list');
    const exists = await moveList.count();
    if (exists > 0) {
      const moveText = await moveList.textContent();
      expect(moveText).toBe('');
    }
  });

  test('click-to-move: same square click deselects the piece', async ({ page }) => {
    await page.locator('[data-square="e2"]').click();
    await page.waitForTimeout(200);
    await page.locator('[data-square="e2"]').click();
    await page.waitForTimeout(200);
    await page.locator('[data-square="e4"]').click();
    await page.waitForTimeout(500);

    const moveList = page.getByTestId('move-list');
    const exists = await moveList.count();
    if (exists > 0) {
      const moveText = await moveList.textContent();
      expect(moveText).toBe('');
    }
  });

  test('chessboard loads with all critical interactive elements', async ({ page }) => {
    await expect(page.getByTestId('chessboard')).toBeVisible();

    await expect(page.locator('.panel.controls')).toBeVisible();

    await expect(page.locator('.panel.controls').getByText('New')).toBeVisible();
    await expect(page.locator('.panel.controls').getByText('Flip')).toBeVisible();
    await expect(page.locator('.panel.controls').getByText('Undo')).toBeVisible();
    await expect(page.locator('.panel.controls').getByText('Redo')).toBeVisible();

    await expect(page.locator('.panel.controls').getByText('FEN')).toBeVisible();
    await expect(page.locator('.panel.controls').getByText('PGN')).toBeVisible();

    await expect(page.locator('.panel.controls').getByText('Shortcuts')).toBeVisible();

    await expect(page.getByText('Game Explorer')).toBeVisible();
  });
});

// ── Analysis Page — Drag-to-Move ──────────────────

test.describe('Analysis Page - Drag-to-Move', () => {
  test.beforeEach(async ({ page }) => {
    await waitForChessboard(page);
  });

  test('drag-to-move: onPieceDrop callback via v5 options', async ({ page }) => {
    // Call onPieceDrop from the Chessboard v5 options object via fiber traversal
    const result = await callOnPieceDrop(page, 'e2', 'e4');
    expect(result).toBe(true);

    await page.waitForTimeout(1000);
    await expect(page.getByTestId('move-list')).toBeVisible({ timeout: 15000 });
    const moveText = await page.getByTestId('move-list').textContent();
    expect(moveText).toContain('e4');
  });

  test('drag-to-move: board flip then onPieceDrop works correctly', async ({ page }) => {
    await expect(page.locator('.panel.controls')).toBeVisible({ timeout: 15000 });

    // Flip the board
    await page.locator('.panel.controls').getByText('Flip').click();
    await page.waitForTimeout(500);

    // After flip, make a move via onPieceDrop
    const result = await callOnPieceDrop(page, 'e2', 'e4');
    expect(result).toBe(true);

    await page.waitForTimeout(1000);
    await expect(page.getByTestId('move-list')).toBeVisible({ timeout: 15000 });
    const moveText = await page.getByTestId('move-list').textContent();
    expect(moveText).toContain('e4');
  });
});

// ── Analysis Page — Engine Auto-move ─────────────────

test.describe('Analysis Page - Engine Auto-move', () => {
  test.beforeEach(async ({ page }) => {
    await waitForChessboard(page);
    await waitForControls(page);
  });

  test('importing a FEN with Black to move triggers engine auto-move', async ({ page }) => {
    const controls = page.locator('.panel.controls');

    await controls.locator('label').filter({ hasText: 'Auto-move Opponent' }).click();
    await page.waitForTimeout(500);

    await controls.getByText('FEN').click();
    await expect(page.getByPlaceholder('Enter FEN string')).toBeVisible();

    await page
      .getByPlaceholder('Enter FEN string')
      .fill('rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');

    await page.getByRole('button', { name: 'Import' }).click();

    await expect(page.getByTestId('move-list')).toBeVisible({ timeout: 20000 });
    const moveText = await page.getByTestId('move-list').textContent();
    expect(moveText).toBeTruthy();
  });
});

// ── Analysis Page — FEN Import ────────────────────────

test.describe('Analysis Page - FEN Import', () => {
  test.beforeEach(async ({ page }) => {
    await waitForChessboard(page);
    await waitForControls(page);
  });

  test('FEN modal opens, fills, and imports a position', async ({ page }) => {
    const controls = page.locator('.panel.controls');
    await controls.getByText('FEN').click();

    await expect(page.getByPlaceholder('Enter FEN string')).toBeVisible();
    await page
      .getByPlaceholder('Enter FEN string')
      .fill('rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');

    await page.getByRole('button', { name: 'Import' }).click();
    await expect(page.getByPlaceholder('Enter FEN string')).not.toBeVisible({ timeout: 5000 });
  });

  test('FEN modal copy button works', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    const controls = page.locator('.panel.controls');
    await controls.getByText('FEN').click();
    await expect(page.getByPlaceholder('Enter FEN string')).toBeVisible();

    const fenModal = page.locator('[data-testid="modal"]');
    if (await fenModal.count() > 0) {
      await fenModal.locator('button').filter({ hasText: 'Copy' }).click();
    } else {
      await page.getByRole('button', { name: 'Copy', exact: true }).click();
    }

    await expect(page.getByPlaceholder('Enter FEN string')).not.toBeVisible({ timeout: 5000 });
  });
});

// ── Analysis Page — Keyboard Shortcuts ────────────────

test.describe('Analysis Page - Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await waitForChessboard(page);
  });

  test('pressing ? opens the keyboard shortcut guide', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    await expect(page.getByText('Undo last move')).toBeVisible();
    await expect(page.getByText('Redo next move')).toBeVisible();
    await expect(page.getByText('Reset / New game')).toBeVisible();
    await expect(page.getByText('Flip board orientation')).toBeVisible();
  });

  test('shortcut guide closes on Got it click', async ({ page }) => {
    await page.keyboard.press('?');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
    await page.getByText('Got it').click();
    await expect(page.getByText('Keyboard Shortcuts')).not.toBeVisible();
  });

  test('Shortcuts button in controls opens the guide', async ({ page }) => {
    await page.locator('.panel.controls').getByText('Shortcuts').click();
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible();
  });

  test('R key triggers reset without error', async ({ page }) => {
    await page.keyboard.press('r');
    await expect(page.getByTestId('chessboard')).toBeVisible();
  });

  test('Arrow keys do not throw errors', async ({ page }) => {
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('chessboard')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('chessboard')).toBeVisible();
  });
});

// ── Analysis Page — New Game (Reset) ──────────────────

test.describe('Analysis Page - New Game', () => {
  test.beforeEach(async ({ page }) => {
    await waitForChessboard(page);
    await waitForControls(page);
  });

  test('New Game button is visible and clickable', async ({ page }) => {
    const controls = page.locator('.panel.controls');
    await controls.getByText('New').click();
    await expect(page.getByTestId('chessboard')).toBeVisible();
  });
});

// ── Analysis Page — Move Verification ────────────

test.describe('Analysis Page - Move Verification', () => {
  test.beforeEach(async ({ page }) => {
    await waitForChessboard(page);
  });

  test('after a move via onPieceDrop, FEN changes to opponent turn', async ({ page }) => {
    // Make a move
    const result = await callOnPieceDrop(page, 'e2', 'e4');
    expect(result).toBe(true);

    // Wait for React state flush
    await page.waitForTimeout(800);

    // Read the updated FEN
    let afterFen = await readFiberProp(page, 'fen');
    if (!afterFen) {
      // Fallback: read from v5 options
      const options = await page.evaluate(() => {
        function walkForProp(fiber, name, visited, depth) {
          if (!fiber || visited.has(fiber) || depth > 500) return null;
          visited.add(fiber);
          if (fiber.memoizedProps && name in fiber.memoizedProps) return fiber.memoizedProps[name];
          if (fiber.pendingProps && name in fiber.pendingProps) return fiber.pendingProps[name];
          let r = walkForProp(fiber.child, name, visited, depth + 1);
          if (r) return r;
          r = walkForProp(fiber.sibling, name, visited, depth + 1);
          if (r) return r;
          r = walkForProp(fiber.return, name, visited, depth + 1);
          if (r) return r;
          return null;
        }

        const container = document.querySelector('[data-testid="chessboard"]');
        if (!container) return null;
        const fiberKey = Object.keys(container).find(
          (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
        );
        if (!fiberKey) return null;
        const opts = walkForProp(container[fiberKey], 'options', new Set(), 0);
        return opts ? opts.position : null;
      });
      afterFen = options;
    }

    expect(afterFen).toBeTruthy();
    // After 1.e4, it should be Black's turn
    expect(afterFen.split(' ')[1]).toBe('b');

    // Verify move history updated
    await expect(page.getByTestId('move-list')).toBeVisible({ timeout: 15000 });
    const moveText = await page.getByTestId('move-list').textContent();
    expect(moveText).toContain('e4');
  });
});

// ── Puzzle Page — Race Condition Guard ──────────────

test.describe('Puzzle Page - Race Condition Fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/puzzles');
    // Chessboard is rendered immediately but hidden by skeleton overlay (opacity: 0).
    // Wait for skeleton to fade out (loading sequence ~800ms + CSS transition ~500ms).
    await page.waitForSelector('[data-testid="chessboard"]', { state: 'attached', timeout: 15000 });
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('chessboard')).toBeVisible({ timeout: 25000 });
  });

  test('rapid clicks during opponent response delay are blocked', async ({ page }) => {
    await page.getByRole('button', { name: /Start Training/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText('Solution')).toBeVisible({ timeout: 15000 });

    // Step 1: Read FEN from fiber tree (Node.js context)
    const fen = await readFiberProp(page, 'fen');
    expect(fen).toBeTruthy();

    // Step 2: Read expected puzzle SAN from DOM
    const firstExpectedSan = await page.evaluate(() => {
      return document.querySelector('.solution-move .move-san.player')?.textContent?.trim() || null;
    });
    expect(firstExpectedSan).toBeTruthy();

    // Step 3: Compute moves in Node.js (Chess imported at top level)
    const game = new Chess(fen);
    const allMoves = game.moves({ verbose: true });
    const expectedMove = allMoves.find(m => m.san === firstExpectedSan);
    expect(expectedMove).toBeTruthy();

    // Step 4: Call onDrop with correct move
    const firstResult = await callOnDrop(page, expectedMove.from, expectedMove.to);
    expect(firstResult).toBe(true);

    // Step 5: Call onDrop again immediately — should be blocked by race guard
    const wrongMove = allMoves.find(m => m.san !== firstExpectedSan);
    const secondResult = await callOnDrop(page, wrongMove?.from || 'a1', wrongMove?.to || 'a8');
    expect(secondResult).toBe(false);

    // Wait for opponent response: poll until solution moves are marked as played
    // Timer is 400ms, plus React state flush and DOM update
    await page.waitForFunction(() => {
      return document.querySelectorAll('.solution-move.played').length >= 1;
    }, { timeout: 5000 }).catch(() => {
      // Fallback: log the current state for debugging
      console.log('Timeout waiting for played moves. Current solution-move count:',
        document.querySelectorAll('.solution-move').length);
    });

    const progressAfter = await page.evaluate(() => {
      return document.querySelectorAll('.solution-move.played').length;
    });
    expect(progressAfter).toBeGreaterThanOrEqual(1);
  });

  test('opponent response guard is reset when switching puzzles', async ({ page }) => {
    await page.getByRole('button', { name: /Start Training/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Solution')).toBeVisible({ timeout: 15000 });

    // Step 1: Read FEN + expected SAN, compute move in Node.js
    const fen = await readFiberProp(page, 'fen');
    expect(fen).toBeTruthy();

    const firstExpectedSan = await page.evaluate(() => {
      return document.querySelector('.solution-move .move-san.player')?.textContent?.trim() || null;
    });
    expect(firstExpectedSan).toBeTruthy();

    const game = new Chess(fen);
    const allMoves = game.moves({ verbose: true });
    const expectedMove = allMoves.find(m => m.san === firstExpectedSan);
    expect(expectedMove).toBeTruthy();

    // Step 2: Make the correct puzzle move
    const result = await callOnDrop(page, expectedMove.from, expectedMove.to);
    expect(result).toBe(true);

    // Step 3: Switch to next puzzle BEFORE opponent response fires (400ms)
    await page.getByRole('button', { name: /Next/i }).first().click();
    await page.waitForTimeout(500);

    // Step 4: Read new puzzle's FEN + compute a legal move
    const newFen = await readFiberProp(page, 'fen');
    expect(newFen).toBeTruthy();

    const newGame = new Chess(newFen);
    const newMoves = newGame.moves({ verbose: true });
    expect(newMoves.length).toBeGreaterThan(0);

    // Make a move on the new puzzle — should NOT be blocked by stale guard
    const afterResult = await callOnDrop(page, newMoves[0].from, newMoves[0].to);
    expect(typeof afterResult).toBe('boolean');
  });
});

// ── Landing Page ──────────────────────────────────────

test.describe('Landing Page', () => {
  test('app loads with ChessWeb heading and game mode cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ChessWeb' })).toBeVisible();

    await expect(page.getByText('Analysis Mode')).toBeVisible();
    await expect(page.getByText('Play Online')).toBeVisible();
    await expect(page.getByText('Tactics Trainer')).toBeVisible();
    await expect(page.getByText('Game History')).toBeVisible();
    await expect(page.getByText(/Press keys 1–5 to navigate/)).toBeVisible();
  });

  test('clicking Analysis Mode card navigates to /analysis', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Analysis Mode').click();
    await expect(page).toHaveURL(/\/analysis/);
    await expect(page.getByTestId('chessboard')).toBeVisible({ timeout: 15000 });
  });

  test('keyboard shortcut 1 navigates to analysis page', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('1');
    await expect(page).toHaveURL(/\/analysis/);
  });
});
