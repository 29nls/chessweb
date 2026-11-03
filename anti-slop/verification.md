# Verification log

Measured against the production build served at `http://localhost:3000`
(`npx serve -s build`), in the app's preview browser, both themes.

## Build and tests

| Command | Result |
|---|---|
| `npx react-scripts test --watchAll=false` | 31 suites, **380 passed**, 0 failed |
| `npm run test:api` | 2 suites, **15 passed** |
| `npm run typecheck` (`tsc --noEmit`) | exit 0 |
| `npx react-scripts build` | exit 0, compiled. Only warning is a pre-existing `node_modules/chess.js` source-map lookup. |
| `npm run e2e` | **not run.** Playwright's Chromium download stalled during extraction twice; see Remaining issues. |

## Overflow (documentElement.scrollWidth - clientWidth)

| Route | Before | After |
|---|---|---|
| `/history` @360 | 22px | **0** |
| `/online` @360 | 24px (card 380px in 356px) | **0** (card 338px in 356px) |
| `/` @360/390/768/1024/1440 | 0 | 0 |
| `/analysis` @360/1024/1440 | 0 | 0 |
| `/puzzles` @360/1024/1440 | 0 (masked by `overflow-x:hidden`) | 0 |
| `/puzzle-rush` @360 | 0 (masked) | 0 |

`overflow-x: hidden` was removed from `body`, so these zeros are real rather
than clipped.

## Puzzle layout (F-001)

| | Before | After |
|---|---|---|
| `.App-body` matches `.puzzle-mode` | `false` | `true` |
| grid-template-columns @1440 | `240px 800px 240px` (analysis template) | `260px 800px 220px` |
| grid-template-areas @1440 | `"evaluation chessboard controls"` | `"info chessboard solution"` |
| board @360 | **2 x 2 px** | **332 x 332** |
| board @1440 | 383px | 680 x 680 |
| info / moves overlap | identical rect `x:1023 y:576` | `infoSolOverlap: false` |
| mobile stack order | overlapping | board, info, solution |

`/puzzle-rush` verified the same way: `matchesRushMode: true`,
`hudSolOverlap: false`, board 332x332 @360.

## Contrast

| Element | Theme | Before | After |
|---|---|---|---|
| `.button-primary` | dark | **3.37:1 FAIL** (near-black on `#2563EB`) | **4.54:1 PASS** (near-black on copper) |
| `.button-primary` | light | (gradient, one end failing) | **6.92:1 PASS** (white on copper) |
| landing badges | dark | 2.15 to 4.23, all six FAIL | removed |

## Touch targets (sub-44px), 360px

| Element | Before | After |
|---|---|---|
| skip link | 37px | 44px |
| `.diff-btn` (4 chips) | 35px | 44px |
| `.rush-time-btn` (3) | 35px | 44px |
| lobby close button | 36px | 44px |
| lobby tabs (2) | 40px | 44px |
| lobby time chips | 30px | 44px |
| lobby code input | 43px | 44px |
| nav back / theme buttons | 38/40px | 44px |
| header wordmark link | 30px | 44px |
| footer GitHub link | 18px | 44px |
| depth slider | 8px hit area | 44px hit area, 8px visual track |

Final state: `/`, `/analysis`, `/online`, `/puzzles`, `/puzzle-rush`, `/history`
all report `small: []` at 360px.

## Motion (F-008)

| | Before | After |
|---|---|---|
| infinite animations on `/` | 16 (56 codebase-wide) | **0** |
| floating pieces | 6 | 0 |
| gradient orbs | 2 | 0 |
| `bg-pattern` overlays | 2 (rendered twice) | 0 |
| landing skeleton | present | 0 |
| `role="progressbar"` on `/` | 1 (timer-driven) | 0 |

## Copy (F-009)

23 em dashes in user-visible strings replaced. Live check across all routes:
0 remaining. Four occurrences the audit did not list were found by the live
sweep and fixed as well: two in `src/lib/supabaseErrors.js`, two toasts plus
the rush rule in `PuzzleRushPage.js`. One `console.warn` retains the character;
that is developer output, outside R-02's UI scope.

## Functional checks

- Board renders 64 squares and 32 pieces, correct algebraic order.
- A real click on e2 then e4 moved the pawn, wrote `1. e4` to move history, and
  the opening explorer identified `Italian, Main Line Greco (C54)`. Move
  validation, history and opening detection all work.
- Accessibility tree on `/analysis` still exposes: engine selector
  (Stockfish 18 WASM), depth 20, MultiPV, FEN, PGN, play-as, auto-move,
  opening explorer, game explorer, and the board's keyboard instructions.

## Not verified

- **Engine evaluation output.** Depth and Nodes read `N/A` in the preview
  browser because it is not `crossOriginIsolated` and has no
  `SharedArrayBuffer`. No engine, worker or hook file was modified (confirmed
  against `git diff --name-only`), and `/stockfish/stockfish-18-lite-single.js`
  serves correctly as `application/javascript`, so this is the preview
  environment rather than the change.
- **`npm run e2e`.** Playwright's browser binary could not be installed: the
  140MB download completed but extraction stalled twice and the process exited.
- **Multiplayer and populated history.** No Supabase credentials in this build.
- **Screenshots above 431px.** The capture tool returns a fixed 431x627 image
  regardless of the page viewport, so wide-viewport evidence is the DOM
  geometry above, not the images.
