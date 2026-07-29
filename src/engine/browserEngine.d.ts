import type { EngineOutput } from './types';

/**
 * Send a UCI command to the browser engine.
 * For `go` commands, returns the monotonic search ID assigned to that search.
 */
export function sendCommand(command: string): number | undefined;

/** Subscribe to engine output events. Returns an unsubscribe function. */
export function onOutput(cb: (data: EngineOutput) => void): () => void;

/** Subscribe to the engine ready event. Returns an unsubscribe function. */
export function onReady(cb: () => void): () => void;

/** Browser engine API object. */
export interface BrowserEngine {
  start(): void;
  stop(): void;
  sendCommand(command: string): number | undefined;
  onOutput(cb: (data: EngineOutput) => void): () => void;
  onReady(cb: () => void): () => void;
}

export const browserEngine: BrowserEngine;
export default browserEngine;
