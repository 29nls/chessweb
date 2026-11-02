---
name: chessweb-performance-reliability
description: Evidence-based performance optimization and reliability
  engineering for the ChessWeb React chess application.
---

# ChessWeb Performance & Reliability

## Mission
Improve ChessWeb performance, application stability, and test
reliability without breaking chess rules, Stockfish integration,
Supabase Realtime, or existing user workflows.

## Non-Negotiable Rules

1. Inspect the existing implementation before changing anything.
2. Never assume a reported issue is still present without reproducing it.
3. Do not rewrite the application architecture unnecessarily.
4. Preserve existing React, chess.js, Stockfish, and Supabase behavior.
5. Do not introduce dependencies without a clear technical reason.
6. Never expose, modify, or commit production secrets.
7. Do not claim a test passed unless it was actually executed.
8. Do not commit or push changes without explicit authorization.

## Required Workflow

### 1. Repository Inspection
- Read README, package.json, and project instructions.
- Inspect the existing skills directory.
- Identify routes, components, hooks, engine adapters, and tests.
- Map dependencies affecting initial page loading.

### 2. Baseline Measurement
Run the existing test and build commands.
Capture a fresh mobile Lighthouse report.
Record:
- Performance score
- First Contentful Paint
- Largest Contentful Paint
- Total Blocking Time
- Cumulative Layout Shift
- JavaScript bundle size

### 3. Root-Cause Analysis
Investigate:
- Landing page layout shifts.
- Skeleton and content transition behavior.
- Eagerly imported route components.
- Unnecessary JavaScript loaded on initial navigation.
- Long-running main-thread tasks.
- Engine initialization and worker lifecycle.

Do not implement speculative optimizations.

### 4. Test-Driven Fixes
Create or improve regression tests before changing
behavior-sensitive code.

Prioritize:
- Landing page stability.
- Route loading and navigation.
- Chess move correctness.
- Undo and redo.
- Stockfish response consistency.
- Existing online-game synchronization.

Use isolated test configuration for Supabase.
Never use production game rooms for testing.

### 5. Targeted Implementation
Fix the verified root causes.
Keep changes small, reversible, and scoped.
Preserve all existing application behavior.

### 6. Verification
Run:
- npm test
- npm run test:api
- npm run e2e
- npm run typecheck
- npm run build

Generate a fresh Lighthouse report after changes.
Compare results against the new baseline.

## Acceptance Criteria

- Existing chess functionality remains correct.
- No new critical console errors.
- No route navigation regressions.
- No broken Stockfish initialization.
- No multiplayer regression.
- Build and available test suites pass.
- CLS target: <= 0.10.
- LCP target: <= 2.5 seconds.
- TBT target: <= 300 milliseconds.

Performance targets must be measured under the same conditions.
If a target cannot be achieved, explain the measured limitation.

## Final Report

Provide:
1. Root cause identified.
2. Files changed.
3. Changes implemented.
4. Tests actually executed and their results.
5. Lighthouse before/after comparison.
6. Remaining risks.
7. Recommended next engineering task.