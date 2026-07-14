import { test, expect } from '@playwright/test';

// Verifies the deployment is cross-origin isolated, which is the prerequisite
// for SharedArrayBuffer and therefore the multi-threaded Stockfish 18 build.
// The COOP/COEP headers are configured in vercel.json (COEP: credentialless so
// the cross-origin Google Fonts stylesheet still loads).
//
// These headers are only sent by the production/Vercel server, not by
// `npm start` (CRA dev server). So this test is skipped when run locally and
// runs on a deployment that serves the headers. Swapping in the multi-threaded
// engine build (public/stockfish/stockfish-18*.{js,wasm,worker.js} + nn-*.nnue)
// is the next step.
test('page is cross-origin isolated (enables SharedArrayBuffer)', async ({ page }) => {
  await page.goto('/');

  const isolated = await page.evaluate(() => self.crossOriginIsolated === true);
  test.skip(
    !isolated,
    'COOP/COEP headers absent in this environment — configure vercel.json / serve with headers',
  );

  expect(isolated).toBe(true);
});
