# Implementation plan: anti-slop audit 001

All 30 findings approved (F-001 to F-031, F-015 unused).
Design direction: `DESIGN.md`, Editorial Chess Studio. Dials ENERGY 2 / RHYTHM 2 / MOTION 1.

Order follows the audit's own suggested fix order, because F-001 makes the puzzle
routes inspectable for everything else, and F-003 must settle the palette before
F-006/F-024/F-025 can be fixed once rather than three times.

## Batch 1 - structure

| Finding | Component | Files | Correction | Regression risk |
|---|---|---|---|---|
| F-001 | Puzzle + Rush layout | `pages/PuzzlePage.css`, `pages/PuzzleRushPage.css` | Change `.puzzle-mode .App-body` to `.App-body.puzzle-mode`, same for rush. Add `grid-area: chessboard` to the board wrappers, which currently have none. | Low. Enables CSS already written. Stack order on the single-column fallback must stay board, info, solution. |
| F-002 | Global box model | `src/index.css`, `pages/HistoryPage.css`, `OnlineLobby.css` | Global `*, *::before, *::after { box-sizing: border-box }`. Remove `overflow-x: hidden` from body so overflow is visible. Fix the lobby card width. | Medium. Changes computed size of every element. Isolated change, full visual pass at 5 breakpoints. |

## Batch 2 - palette

| Finding | Component | Files | Correction | Regression risk |
|---|---|---|---|---|
| F-003 | Tokens | `src/index.css` | Delete the duplicate `:root` and `[data-theme='dark']` blocks. `design-system.css` becomes the only token source. | Medium. The duplicate currently loses the cascade, so deleting it is safe; the risk is in the hardcoded hex replaced elsewhere. |
| F-006 | Primary button | `src/App.css` | `background: var(--accent-primary)`, `color: var(--accent-on-fill)`, border same as fill. Delete the dark gradient override and the `#fff`. | Low. One class, all routes checked visually. |
| F-024 | Primary button | `src/App.css` | Same change as F-006; resolves hue count together. | Low. |
| F-025 | Primary button | `src/App.css` | Same change as F-006; removes the two-stop luminance span. | Low. |
| F-007 | Landing badges | `LandingScreen.js`, `LandingScreen.css` | Remove all six badges and their per-variant colours. | Very low. Decorative spans, no handlers. |
| F-021 | "Popular" badge | `LandingScreen.js` | Removed with F-007; the claim goes with the styling. | None. |

## Batch 3 - type

| Finding | Component | Files | Correction | Regression risk |
|---|---|---|---|---|
| F-012 | Type system | `src/index.css`, `design-system.css`, `App.css` | Drop the unused Inter `@import`. One `--font-sans` token in `design-system.css`, inherited everywhere. Add `font-variant-numeric: tabular-nums` to clocks, eval values, move numbers. | Medium. Font metrics shift heading wrapping at the hero. Pass at 5 breakpoints. |
| F-013 | Monospace | `App.css`, `LandingScreen.css`, `OnlineLobby.css`, `pages/PuzzlePage.css`, `components/OpeningExplorer.css` | Replace the nine `'Inter', monospace` / `'Segoe UI', monospace` declarations with `var(--font-mono)`. | Low. Short strings only. Check invite-code width fits six characters. |

## Batch 4 - motion and decoration

| Finding | Component | Files | Correction | Regression risk |
|---|---|---|---|---|
| F-008 | Landing motion | `LandingScreen.css`, `src/index.css` | Remove the two orbs, six floating pieces, logo glow pulse, logo piece bounce, H1 gradient shift. Neutralise the decorative skeleton idle loops. Keep shimmer and pulse, which communicate loading state. | Low. All removed elements are `aria-hidden` and `pointer-events: none`. |
| F-005 | Board pattern | `LandingScreen.js`, `LandingScreen.css` | Remove the tiled board overlay. | Very low. Fixed, behind content, aria-hidden. |
| F-029 | Duplicate pattern | `LandingScreen.js` | Disappears with F-020, since the skeleton tree is removed. | None. |
| F-020 | Fake skeleton | `LandingScreen.js`, `LandingScreen.css` | Delete the landing skeleton, its five invented Indonesian steps, and the timer-driven progressbar. Render content immediately. `useLoadingSequence` stays for routes that really load. | Low, removes work. Shared fade classes stay. |
| F-004 | Gradients | 6 files | Flatten the multi-hue stacks to the accent token. Position, size and weight carry hierarchy instead of hue rotation. | Low. Colour only, but broad. Both themes. |
| F-010 | Elevation | `design-system.css`, `LandingScreen.css` | Raised shadow only on surfaces that float (modals, lobby card). In-flow panels go flat with a border. Card hover becomes one shadow plus a border change. Delete the blue halo on the copper button. | Low. Visual only. |
| F-011 | Glass | `design-system.css`, `OnlineLobby.css` | Header becomes opaque. Keep blur only on the two true overlays (lobby backdrop, game review backdrop). Remove the two nested blurs. | Low. Header keeps border and colour. |

## Batch 5 - landing content

| Finding | Component | Files | Correction | Regression risk |
|---|---|---|---|---|
| F-014 | Stat row | `LandingScreen.js`, `LandingScreen.css` | Remove the row. Three of four figures were a version number, a format and a slider default wearing the costume of statistics. | Very low. Presentational. |
| F-030 | Puzzle count | `LandingScreen.js` | Resolved by removal of both hardcoded mentions with F-014 and F-018. | None. |
| F-016 | Depth claim | `LandingScreen.js` | State the real default, depth 20, configurable higher. | None. Copy. |
| F-017 | Buzzwords | `LandingScreen.js` | Replace "powerful engine assistance" and "take your chess game to the next level" with the actual mechanism. | None. Copy. |
| F-018 | Duplicate features | `LandingScreen.js`, `LandingScreen.css` | Merge: give each mode card the mockup of the screen it leads to, drop the separate features section and its heading. | Low. Card gains a visual slot. |
| F-019 | Section rhythm | `LandingScreen.css` | Spacing scale with four levels assigned by content weight. | Very low. Margins only. |
| F-022 | Icons | `LandingScreen.js` | Tactics Trainer gets its own glyph. Brand mark becomes a knight, not a CPU chip. | None. Decorative, aria-hidden. |
| F-023 | Theme hint | `LandingScreen.js`, `LandingScreen.css` | Remove. It described a labelled control two inches above it. | None. aria-hidden block. |

## Batch 6 - copy, targets, semantics

| Finding | Component | Files | Correction | Regression risk |
|---|---|---|---|---|
| F-009 | Em dashes | `data/puzzles.js`, `public/index.html`, `hooks/useOnlineGame.js` | 23 user-visible occurrences replaced with a colon, comma or full stop. | Very low. One test asserts on a description string and must be updated, not deleted. |
| F-027 | Tap targets | `design-system.css`, `pages/PuzzlePage.css` | `.diff-btn` to 44px min-height with wider padding. Skip link to 44px. | Very low. Filter row grows 9px; check panel height at 360px. |
| F-026 | Emoji | `components/GameHistoryPanel.js`, `pages/PuzzlePage.js`, `pages/PuzzleRushPage.js` | Replace with the icon set already in use, or drop and let the heading carry the state. | None. Presentational. |
| F-028 | theme-color | `public/index.html` | Point at the current tokens with a comment naming each. | None. |
| F-031 | Wordmark | `design-system.css`, `components/AppLayout.js` | Real text in a `<Link to="/">`, replacing the `::before`. Reconcile with the existing Back to Home button. | Low. One interaction changes; the back button already covers that path. |

## Not in scope

No routing, chess logic, engine, Supabase, schema or policy changes. `useOnlineGame.js`
receives a copy-only edit for F-009; its logic is untouched.
