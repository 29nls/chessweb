/** A move classification label as returned by classifyMove. */
export interface MoveClassification {
  label: string;
  icon: string;
  color: string;
}

/** Map of label keys to their display metadata. */
export const LABELS: Record<string, MoveClassification>;

/** Map of label keys to PGN NAG strings. */
export const CLASS_TO_NAG: Record<string, string>;

/** Build a complete PGN string with NAG annotations. */
export function buildPgnWithNag(
  headers: Record<string, string>,
  movesArray: string[],
  classifications: (MoveClassification | null)[]
): string;

/** Convert a centipawn loss value to a 0-100 accuracy score. */
export function lossToAccuracy(loss: number): number;

/** Compute per-side accuracy report from classifications and moves. */
export function computeAccuracyReport(
  classifications: (MoveClassification | string | null)[],
  moves: string[]
): {
  white: { accuracy: number; counts: Record<string, number>; moves: number };
  black: { accuracy: number; counts: Record<string, number>; moves: number };
};

/** Get the LABELS key (e.g. 'BRILLIANT') for a classification object. */
export function getLabelKey(cls: MoveClassification | null): string | null;

/** Classify a move based on centipawn loss and context. */
export function classifyMove(
  loss: number,
  beforeEval: number,
  afterEval: number,
  isEngineMove?: boolean
): MoveClassification;

/** Calculate centipawn loss from the player's perspective. */
export function calculateLoss(
  beforeEval: number,
  afterEval: number,
  sideThatMoved: 'w' | 'b'
): number;
