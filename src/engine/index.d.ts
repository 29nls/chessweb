import type { Engine } from './types';

/**
 * Create an Stockfish engine instance.
 * @param mode - 'browser' uses the local WASM worker; 'backend' connects via Socket.IO.
 * @param backendUrl - URL of the backend Socket.IO server (only used in 'backend' mode).
 */
export function createEngine(mode?: 'browser' | 'backend', backendUrl?: string): Engine;
