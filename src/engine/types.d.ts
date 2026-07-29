/**
 * Shared engine types for the browser and backend Stockfish wrappers.
 *
 * These types live in a single file so that browserEngine.js, engine/index.js,
 * and useChessEngine.js all refer to the same shape without needing to convert
 * the implementation files to TypeScript.
 */

/** Score reported by Stockfish in centipawns or mate distance. */
export interface EngineScore {
  type: 'cp' | 'mate';
  value: number;
}

/** A single `info` line emitted during analysis. */
export interface EngineInfo {
  type: 'info';
  /** Search ID that produced this output; null if the engine does not tag output. */
  searchId: number | null;
  /** Raw UCI line as received from Stockfish. */
  raw: string;
  score: EngineScore | null;
  /** Principal variation as a list of UCI move strings. */
  pv: string[];
  depth: number | null;
  nodes: number | null;
  nps: number | null;
  tbhits: number | null;
  multipv: number;
}

/** Event emitted when Stockfish reports the best move for a search. */
export interface EngineBestMove {
  type: 'bestmove';
  searchId: number | null;
  move: string;
}

/** Engine-level error (worker error, socket error, etc.). */
export interface EngineError {
  type: 'error';
  message: string;
  searchId?: number | null;
}

/** Union of all messages that can come out of the engine. */
export type EngineOutput = EngineInfo | EngineBestMove | EngineError;

/** Engine facade returned by createEngine. */
export interface Engine {
  /** Register a callback to run once the engine is ready/connected. */
  onConnect(cb: () => void): void;
  /**
   * Send a raw UCI command to the engine.
   * Returns the assigned search ID for `go` commands, otherwise undefined.
   */
  sendCommand(command: string): number | undefined;
  /** Register a callback for engine output. Returns an unsubscribe function. */
  onOutput(cb: (data: EngineOutput) => void): () => void;
  /** Tear down the engine connection/worker. */
  disconnect(): void;
}
