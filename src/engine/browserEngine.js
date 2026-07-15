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
    emit({
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
  ready = false;
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
