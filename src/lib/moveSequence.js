/**
 * Move sequencing helpers for online play.
 *
 * Moves are broadcast over Supabase Realtime, which is at-most-once and does not
 * guarantee ordering. Each move carries a 1-based `sequence` equal to its index
 * in the game (move 1, move 2, ...). Comparing that sequence against how many
 * moves we have already applied tells us whether an incoming move is a
 * duplicate, the next move we expect, or evidence that we missed something.
 */

export const MOVE_SEQUENCE_RESULT = Object.freeze({
  /** Already applied (or older than the position we hold). Ignore it. */
  DUPLICATE: 'duplicate',
  /** Exactly the move we are waiting for. Apply it. */
  APPLY: 'apply',
  /** One or more earlier moves never arrived. Recover state instead of guessing. */
  GAP: 'gap',
});

/**
 * Classify an incoming move relative to the number of moves already applied.
 *
 * @param {Object} params
 * @param {number|null|undefined} params.sequence - 1-based sequence from the sender.
 * @param {number} params.appliedCount - How many moves the local board has applied.
 * @returns {'duplicate'|'apply'|'gap'} One of MOVE_SEQUENCE_RESULT.
 */
export function classifyIncomingMove({ sequence, appliedCount }) {
  // Defensive: an unknown applied count means we cannot reason about order.
  const applied = Number.isFinite(appliedCount) && appliedCount > 0 ? appliedCount : 0;

  // Legacy peers may not send a sequence. Accept the move and let the caller's
  // legality check decide whether it fits the current position.
  if (sequence == null || !Number.isFinite(sequence)) {
    return MOVE_SEQUENCE_RESULT.APPLY;
  }

  const expected = applied + 1;

  if (sequence < expected) return MOVE_SEQUENCE_RESULT.DUPLICATE;
  if (sequence > expected) return MOVE_SEQUENCE_RESULT.GAP;
  return MOVE_SEQUENCE_RESULT.APPLY;
}

/**
 * Build the 1-based sequence number for the next outgoing move.
 *
 * @param {number} appliedCount - Moves already on the board before this move.
 * @returns {number} The sequence to attach to the outgoing move.
 */
export function nextMoveSequence(appliedCount) {
  const applied = Number.isFinite(appliedCount) && appliedCount > 0 ? appliedCount : 0;
  return applied + 1;
}
