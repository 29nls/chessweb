import type { Chess, Move } from 'chess.js';
import type { EngineScore } from '../engine/types';
import type { MoveClassification } from '../MoveClassification';

export interface UseChessEngineOptions {
  threads?: number;
  hashSize?: number;
  fen?: string;
  /** Called when Stockfish returns a best move. Receives the position after the move is applied. */
  onBestMove?: (game: Chess, move: Move) => void;
  multiPv?: number;
}

export interface StockfishEval {
  score: number | null;
  type: 'cp' | 'mate';
  depth?: number;
  pv?: string[];
  nodes?: number;
  nps?: number;
  tbhits?: number;
}

export interface UseChessEngineResult {
  engineReady: boolean;
  stockfishEval: StockfishEval;
  moveClassifications: MoveClassification[];
  multiPvLines: StockfishEval[];
  /** Send a raw UCI command to the engine. */
  sendCommand(command: string): void;
  /** Mark the next engine output for move classification from `side`'s perspective. */
  prepareClassification(side: 'w' | 'b'): void;
  /** Cancel any pending classification. */
  cancelClassification(): void;
  /** Reset the current evaluation display. */
  resetEval(): void;
  /** Clear all move classifications. */
  resetClassifications(): void;
  /** Trim the classification history to `end` items. */
  sliceClassifications(end: number): void;
  /** Append a classification label to the history. */
  addClassification(label: MoveClassification): void;
  engineMode: string;
  backendUrl: string;
}

/**
 * React hook that manages Stockfish initialization, evaluation, and move classification.
 * @param options - Engine settings and callbacks.
 */
export function useChessEngine(options: UseChessEngineOptions): UseChessEngineResult;

/**
 * Normalize a raw Stockfish score to White's perspective.
 * @param score - The engine score object (cp or mate) with a non-null value.
 * @param turn - The side to move ('w' or 'b').
 */
export function normalizeEvaluationToWhite(
  score: EngineScore,
  turn: 'w' | 'b'
): EngineScore;
