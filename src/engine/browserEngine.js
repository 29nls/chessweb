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

const WORKER_URL = process.env.PUBLIC_URL
  ? `${process.env.PUBLIC_URL}/stockfish/stockfish-18-lite-single.js`
  : '/stockfish/stockfish-18-lite-single.js';

let worker = null;
let ready = false;
let restartTimer = null;
const outputListeners = new Set();
const readyListeners = new Set();

// ── Info throttling ──────────────────────────────────────
// Stockfish emits hundreds of `info` lines per second during analysis.
// Processing every line (parsing + React state updates) blocks the main
// thread and triggers Chrome's '[Violation] 'message' handler took Nms'.
// We throttle info emissions to ~80ms intervals (~12 updates/sec),
// which is more than adequate for the evaluation display.
let throttledInfo = null;
let infoTimer = null;
const INFO_THROTTLE_MS = 80;


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

function handleLine(line) {
  if (line.startsWith('info')) {
    const matchPv = line.match(/ pv (.+)/);
    const matchScore = line.match(/score (cp|mate) (-?\d+)/);
    const matchDepth = line.match(/depth (\d+)/);
    const matchNodes = line.match(/nodes (\d+)/);
    const matchNps = line.match(/nps (\d+)/);
    const matchtbhits = line.match(/tbhits (\d+)/);
    const matchMultiPv = line.match(/multipv (\d+)/);
    emitInfo({
      type: 'info',
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
    emit({ type: 'bestmove', move });
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
  worker = new Worker(WORKER_URL);
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
  if (infoTimer) {
    clearTimeout(infoTimer);
    infoTimer = null;
    throttledInfo = null;
  }
  ready = false;
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
  worker.postMessage(command);
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
