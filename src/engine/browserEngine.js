// Browser Stockfish (WebAssembly) engine — no backend required.
//
// Loads the WASM build from /stockfish/ (self-hosted in public/stockfish)
// as a Web Worker. It speaks plain UCI over postMessage, identical to the
// backend's stdout, so parsing/output mirrors backend/server.js. This lets
// ChessWeb run fully client-side (e.g. on Vercel) with zero backend.
//
// ponytail: single-threaded NNUE build chosen for simplicity/portability.
// Multi-threaded (needs SharedArrayBuffer + COOP/COEP headers) is the upgrade
// path when higher nps is needed.

const WORKER_URL = process.env.PUBLIC_URL
  ? `${process.env.PUBLIC_URL}/stockfish/stockfish-nnue-16.js`
  : '/stockfish/stockfish-nnue-16.js';

let worker = null;
let ready = false;
let restartTimer = null;
const outputListeners = new Set();
const readyListeners = new Set();
let outputBuffer = '';

function parse(raw) {
  if (!raw) return;
  outputBuffer += raw;
  let newlineIndex;
  while ((newlineIndex = outputBuffer.indexOf('\n')) !== -1) {
    const line = outputBuffer.substring(0, newlineIndex).trim();
    outputBuffer = outputBuffer.substring(newlineIndex + 1);
    if (!line) continue;

    if (line.startsWith('info')) {
      const matchPv = line.match(/ pv (.+)/);
      const matchScore = line.match(/score (cp|mate) (-?\d+)/);
      const matchDepth = line.match(/depth (\d+)/);
      const matchNodes = line.match(/nodes (\d+)/);
      const matchNps = line.match(/nps (\d+)/);
      const matchtbhits = line.match(/tbhits (\d+)/);
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
