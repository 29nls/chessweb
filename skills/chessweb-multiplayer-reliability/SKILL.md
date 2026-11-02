---
name: chessweb-multiplayer-reliability
description: Build reliable real-time multiplayer chess systems
  with authoritative game state, ordered events, reconnection,
  synchronization, and concurrency-safe operations.
---

# ChessWeb Multiplayer Reliability Engineering

## Mission

Improve the correctness, consistency, and resilience of
ChessWeb online multiplayer.

Preserve the existing React, chess.js, Supabase Realtime,
and Stockfish architecture wherever technically appropriate.

## Core Principles

1. The server/database must determine accepted game state.
2. Never trust client broadcasts as authoritative game mutations.
3. Every accepted move must have a unique sequence number.
4. Duplicate and out-of-order events must not corrupt game state.
5. Presence indicates connectivity, not player authorization.
6. Reconnection must restore the canonical match state.
7. Spectators must remain strictly read-only.
8. Game clocks must not depend on client timer accuracy.
9. All state-changing operations must be concurrency-safe.
10. Preserve existing functionality.

## Engineering Requirements

### Game State

Maintain a consistent canonical representation:

- Game ID
- Player identities
- Assigned colors
- Current FEN
- Ordered move history
- Current move sequence
- Game status
- Result and termination reason
- Time control
- Clock state
- Last authoritative update timestamp

Inspect existing database structures before creating new ones.

### Move Processing

- Validate move authorization.
- Validate whose turn it is.
- Validate chess legality using chess.js on a trusted server.
- Prevent duplicate move submissions.
- Enforce expected sequence/version.
- Persist accepted moves atomically.
- Broadcast committed state changes.

### Reconnection

- Recover the current game state.
- Restore move history.
- Restore player identity and color.
- Restore clock state.
- Reconcile missed events.
- Prevent duplicate subscriptions.
- Handle reconnect retries safely.

### Presence and Multiplayer

Handle:
- SUBSCRIBED
- TIMED_OUT
- CHANNEL_ERROR
- CLOSED
- Opponent disconnect
- Opponent reconnect
- Spectator join and leave
- Duplicate player identity
- Simultaneous seat claims

### Chess Clock

- Use authoritative timestamps.
- Track active player.
- Prevent duplicate flag fall.
- Reconcile clock state after reconnection.
- Avoid trusting client-submitted remaining time.
- Prevent both clients from independently
  declaring conflicting timeout results.

### Game Actions

Ensure consistent handling of:

- Normal moves
- Promotion
- Castling
- En passant
- Checkmate
- Stalemate
- Draw offers
- Draw acceptance
- Resignation
- Takeback requests
- Takeback acceptance
- Time forfeits
- Game termination

## Testing

Use:

- Jest
- React Testing Library
- Playwright
- Isolated Supabase test environment

Test two separate browser contexts for multiplayer.

Simulate:
- Network interruption
- Browser refresh
- Reconnection
- Duplicate events
- Out-of-order moves
- Simultaneous move requests
- Simultaneous player joins
- Clock drift
- Spectator reconnection

## Security

- Never expose service_role keys.
- Review Supabase RLS policies.
- Validate player permissions server-side.
- Prevent spectator game mutations.
- Do not trust client-supplied player colors.
- Do not allow unauthorized room access.
- Protect game state mutations against replay.

## Delivery Rules

- Inspect before editing.
- Use incremental changes.
- Do not rewrite the entire application.
- Do not duplicate existing database tables.
- Create versioned migrations when necessary.
- Never execute destructive production migrations.
- Never claim tests passed without execution.
- Never commit or push without authorization.

## Final Report

Report:

1. Multiplayer architecture findings.
2. Verified failure points.
3. Architecture decisions.
4. Files changed.
5. Database migrations.
6. Tests executed.
7. Actual test results.
8. Remaining limitations.
9. Next recommended milestone.