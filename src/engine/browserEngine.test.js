// Tests the browser Stockfish (WASM) engine facade by mocking the Web Worker
// global so UCI output parsing (handleLine) can be exercised without a real
// worker or browser.

class MockWorker {
  constructor(url) {
    this.url = url;
    this.posted = [];
    global.__lastWorker = this;
  }
  postMessage(msg) {
    this.posted.push(msg);
  }
  set onmessage(fn) {
    this._onmessage = fn;
  }
  set onerror(fn) {
    this._onerror = fn;
  }
  terminate() {
    global.__lastWorker = null;
  }
  // Simulate an incoming UCI message from the worker.
  emit(data) {
    if (this._onmessage) this._onmessage({ data });
  }
}

// Flush any microtasks so the Promise-based command queue has a chance to
// post commands and update internal search tracking before the test emits
// engine output synchronously.
function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let browserEngine;

beforeAll(async () => {
  global.Worker = MockWorker;
  ({ browserEngine } = await import('./browserEngine'));
});

afterEach(() => {
  browserEngine.stop();
});

test('sendCommand creates a worker and posts the command', () => {
  browserEngine.sendCommand('uci');
  const w = global.__lastWorker;
  expect(w).toBeInstanceOf(MockWorker);
  expect(w.posted).toContain('uci');
});

test('onOutput parses info lines (score, depth, pv) and tags the current searchId', async () => {
  const received = [];
  const off = browserEngine.onOutput((d) => received.push(d));

  browserEngine.sendCommand('position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const searchId = browserEngine.sendCommand('go depth 12');
  await flushPromises();

  const w = global.__lastWorker;
  w.emit('info depth 12 score cp 34 pv e2e4 e7e5');

  const info = received.find((r) => r.type === 'info');
  expect(info).toBeTruthy();
  expect(info.searchId).toBe(searchId);
  expect(info.score).toEqual({ type: 'cp', value: 34 });
  expect(info.depth).toBe(12);
  expect(info.pv).toEqual(['e2e4', 'e7e5']);

  off();
});

test('onOutput parses bestmove (ignoring ponder suffix) and tags the current searchId', async () => {
  const received = [];
  const off = browserEngine.onOutput((d) => received.push(d));

  const searchId = browserEngine.sendCommand('go movetime 1000');
  await flushPromises();

  const w = global.__lastWorker;
  w.emit('bestmove e2e4 ponder e7e5');

  const bm = received.find((r) => r.type === 'bestmove');
  expect(bm).toBeTruthy();
  expect(bm.searchId).toBe(searchId);
  expect(bm.move).toBe('e2e4');

  off();
});

test('onReady fires once uciok is received', () => {
  let ready = false;
  const off = browserEngine.onReady(() => {
    ready = true;
  });

  const w = global.__lastWorker;
  w.emit('uciok');

  expect(ready).toBe(true);
  off();
});
