// Browser Stockfish (WebAssembly) engine — no backend required.
//
// Loads the WASM build from /stockfish/ (self-hosted in public/stockfish)
// as a Web Worker. It speaks plain UCI over postMessage, identical to the
// backend's stdout, so parsing/output mirrors backend/server.js. This lets
// ChessWeb run fully client-side (e.g. on Vercel) with zero backend.
//
// Uses the official nmrugg/stockfish.js "lite single" build: single-threaded
// (no SharedArrayBuffer / COOP-COEP headers) with the NNUE net EMBEDDED in
// the .wasm, so it works as a static deploy with no extra net file.
// The worker fetches its .wasm by swapping .js -> .wasm on its own path, so
// the two files MUST share the same basename.

import { isGoCommand } from './uciUtil';

const WORKER_URL = process.env.PUBLIC_URL
  ? `${process.env.PUBLIC_URL}/stockfish/stockfish-18-lite-single.js`
  : '/stockfish/stockfish-18-lite-single.js';

let worker = null;
let ready = false;
let restartTimer = null;
const outputListeners = new Set();
const readyListeners = new Set();

// ── Search request tracking ──────────────────────────────
// Each UCI 'go' command starts a new search. Tagging every emitted
// info/bestmove with a monotonic searchId lets consumers correlate
// engine output with the search that produced it and discard stale
// output from a superseded analysis.
let searchIdCounter = 0;
let currentSearchId = null;
let isSearching = false;

// ── Promise-based command queue for stop-ack ordering ────
// UCI is asynchronous; sending a new `position`/`go` while the worker
// is still calculating the previous position produces stale output. Commands
// are chained into a single Promise queue. When a new position/go is issued
// while a search is active, a `stop` is sent and the queue waits for the
// corresponding `bestmove` (or a safety timeout) before issuing the next
// command.
let executionChain = Promise.resolve();
let stopAckResolver = null;
let stopAckTimer = null;
const STOP_ACK_TIMEOUT_MS = 500;

// ── Info throttling ──────────────────────────────────────
// Stockfish emits hundreds of `info` lines per second during analysis.
// Processing every line (parsing + React state updates) blocks the main
// thread and triggers Chrome's '[Violation] 'message' handler took Nms'.
// We throttle info emissions to ~80ms intervals (~12 updates/sec),
// which is more than adequate for the evaluation display.
let throttledInfo = null;
let infoTimer = null;
const INFO_THROTTLE_MS = 80;


// ── Compiled regex patterns ──────────────────────────────
// Pre-compiled for handleLine, which is called hundreds of times/sec
// during Stockfish analysis. Avoids re-creating regex objects on every call.
const RE_PV = / pv (.+)/;
const RE_SCORE = /score (cp|mate) (-?\d+)/;
const RE_DEPTH = /depth (\d+)/;
const RE_NODES = /nodes (\d+)/;
const RE_NPS = /nps (\d+)/;
const RE_TBHITS = /tbhits (\d+)/;
const RE_MULTIPV = /multipv (\d+)/;

function parse(raw) {
  if (!raw) return;
  // The WASM worker emits each UCI line as a separate postMessage, usually
  // without a trailing newline. Process every line in this message directly.
  // Do NOT carry a cross-message buffer: that would concatenate unrelated
  // lines (e.g. "...nnu" + "uciok" -> "...nnuuciok") and break detection.
  const text = typeof raw === 'string' ? raw : String(raw?.data ?? '');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) handleLine(trimmed);
  }
}

function resolveStopAck() {
  if (stopAckTimer) {
    clearTimeout(stopAckTimer);
    stopAckTimer = null;
  }
  if (stopAckResolver) {
    stopAckResolver();
    stopAckResolver = null;
  }
}

function waitForStopAck() {
  return new Promise((resolve) => {
    stopAckResolver = resolve;
    stopAckTimer = setTimeout(() => {
      stopAckResolver = null;
      resolve();
    }, STOP_ACK_TIMEOUT_MS);
  });
}

function handleLine(line) {
  if (line.startsWith('info')) {
    const matchPv = line.match(RE_PV);
    const matchScore = line.match(RE_SCORE);
    const matchDepth = line.match(RE_DEPTH);
    const matchNodes = line.match(RE_NODES);
    const matchNps = line.match(RE_NPS);
    const matchtbhits = line.match(RE_TBHITS);
    const matchMultiPv = line.match(RE_MULTIPV);
    emitInfo({
      type: 'info',
      searchId: currentSearchId,
      raw: line,
      score: matchScore
        ? { type: matchScore[1], value: parseInt(matchScore[2], 10) }
        : null,
      pv: matchPv ? matchPv[1].split(' ') : [],
      depth: matchDepth ? parseInt(matchDepth[1], 10) : null,
      nodes: matchNodes ? parseInt(matchNodes[1], 10) : null,
      nps: matchNps ? parseInt(matchNps[1], 10) : null,
      tbhits: matchtbhits ? parseInt(matchtbhits[1], 10) : null,
      multipv: matchMultiPv ? parseInt(matchMultiPv[1], 10) : 1,
    });
  } else if (line.startsWith('bestmove')) {
    // Flush any pending throttled info so the final evaluation is delivered
    // before the bestmove is processed (critical for move classification).
    flushPendingInfo();
    const move = line.split(' ')[1];
    emit({ type: 'bestmove', searchId: currentSearchId, move });

    // Mark the current search as finished and resolve any pending stop-ack.
    isSearching = false;
    resolveStopAck();
  } else if (line === 'uciok' || line === 'readyok') {
    if (!ready) {
      ready = true;
      readyListeners.forEach((cb) => cb());
    }
  }
}

function emit(data) {
  outputListeners.forEach((cb) => cb(data));
}

/**
 * Emit `info` data with throttling. The first info line in a burst fires
 * immediately; subsequent lines within the throttle window are batched and
 * the latest one is emitted when the window expires. This prevents React
 * state-update storms from Stockfish's rapid analysis output.
 *
 * Non-info data (bestmove, uciok, etc.) is NOT throttled.
 */
function emitInfo(infoData) {
  throttledInfo = infoData;

  if (!infoTimer) {
    // First info in a burst — emit immediately, then set throttle window
    emit(throttledInfo);
    infoTimer = setTimeout(() => {
      infoTimer = null;
      // If a newer info line arrived during throttle, emit it
      if (throttledInfo && throttledInfo !== infoData) {
        emit(throttledInfo);
      }
      throttledInfo = null;
    }, INFO_THROTTLE_MS);
  }
}

/**
 * Force-flush any pending throttled info. Call before emitting
 * bestmove or other critical messages so downstream code gets the
 * final evaluation before the move is applied.
 */
function flushPendingInfo() {
  if (infoTimer) {
    clearTimeout(infoTimer);
    infoTimer = null;
  }
  if (throttledInfo) {
    emit(throttledInfo);
    throttledInfo = null;
  }
}

function start() {
  if (worker) return;
  try {
    worker = new Worker(WORKER_URL);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[BrowserEngine] failed to load worker:', err.message);
    emit({ type: 'error', message: `Failed to load Stockfish worker: ${err.message}` });
    return;
  }
  worker.onmessage = (e) => parse(typeof e.data === 'string' ? e.data : e.data?.data);
  worker.onerror = (err) => {
    // eslint-disable-next-line no-console
    console.error('[BrowserEngine] worker error:', err.message);
    emit({ type: 'error', message: err.message });
  };
  worker.postMessage('uci');
}

function stop() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (stopAckTimer) {
    clearTimeout(stopAckTimer);
    stopAckTimer = null;
  }
  if (infoTimer) {
    clearTimeout(infoTimer);
    infoTimer = null;
    throttledInfo = null;
  }
  ready = false;
  isSearching = false;
  // Reset the Promise chain so any pending commands are dropped.
  executionChain = Promise.resolve();
  // Resolve any pending stop-ack wait so the chain doesn't hang.
  resolveStopAck();
  // Bersihkan semua listeners untuk mencegah stale callback saat re-mount
  readyListeners.clear();
  outputListeners.clear();
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

export function sendCommand(command) {
  if (!worker) start();

  // If the worker failed to initialize, do not attempt to post.
  if (!worker) {
    emit({ type: 'error', message: 'Engine worker is not available' });
    return null;
  }

  let allocatedId = null;
  if (isGoCommand(command)) {
    allocatedId = ++searchIdCounter;
  }

  // Append an async task to the chain. The task will wait for any active
  // search to stop before posting commands that would change the position.
  executionChain = executionChain.then(async () => {
    const lower = command.toLowerCase();

    // If an explicit stop is sent, halt the worker and wait for bestmove.
    if (lower === 'stop') {
      if (isSearching) {
        worker.postMessage('stop');
        await waitForStopAck();
      }
      return;
    }

    // Commands that would start a new search or change the position must
    // wait for any running search to fully stop first.
    const needsCleanState = (lower.startsWith('position') || lower === 'ucinewgame' || isGoCommand(command)) && isSearching;
    if (needsCleanState) {
      worker.postMessage('stop');
      await waitForStopAck();
      if (!worker) return;
    }

    if (isGoCommand(command)) {
      isSearching = true;
      currentSearchId = allocatedId;
    }

    if (!worker) return;

    try {
      worker.postMessage(command);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[BrowserEngine] failed to post command:', err.message);
      emit({ type: 'error', message: `Failed to send command: ${err.message}` });
    }
  }).catch((err) => {
    // Prevent a single failed command from breaking the entire queue.
    // eslint-disable-next-line no-console
    console.error('[BrowserEngine] command failed:', err.message);
  });

  return allocatedId;
}

export function onOutput(cb) {
  outputListeners.add(cb);
  return () => outputListeners.delete(cb);
}

export function onReady(cb) {
  if (ready) {
    cb();
    return () => {};
  }
  readyListeners.add(cb);
  start();
  return () => readyListeners.delete(cb);
}

export const browserEngine = { start, stop, sendCommand, onOutput, onReady };
export default browserEngine;
