// Tests the engine facade (createEngine) for both modes:
//  - 'browser' delegates to the in-browser WASM worker
//  - 'backend' delegates to a Socket.IO connection
// socket.io-client is mocked so no network connection is made.

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

import { createEngine } from './index';
import { io } from 'socket.io-client';

// CRA's Jest preset sets resetMocks: true, which wipes any implementation set
// at mock-declaration time before each test. Re-establish it in beforeEach so
// io() returns a fresh socket for every test.
beforeEach(() => {
  io.mockImplementation(() => ({
    connected: true,
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  }));
});

describe("createEngine('browser')", () => {
  test('exposes the engine interface', () => {
    const engine = createEngine('browser');
    expect(typeof engine.onConnect).toBe('function');
    expect(typeof engine.sendCommand).toBe('function');
    expect(typeof engine.onOutput).toBe('function');
    expect(typeof engine.disconnect).toBe('function');
  });
});

describe("createEngine('backend')", () => {
  test('connects to the given backend URL', () => {
    createEngine('backend', 'http://localhost:3001');
    expect(io).toHaveBeenCalledWith('http://localhost:3001');
  });

  test('sendCommand emits a "command" over the socket', () => {
    const engine = createEngine('backend', 'http://localhost:3001');
    engine.sendCommand('go movetime 1000');
    const socket = io.mock.results[0].value;
    expect(socket.emit).toHaveBeenCalledWith('command', 'go movetime 1000');
  });

  test('onOutput forwards stockfish_output messages', () => {
    const engine = createEngine('backend', 'http://localhost:3001');
    const received = [];
    engine.onOutput((d) => received.push(d));

    const socket = io.mock.results[0].value;
    const handler = socket.on.mock.calls.find((c) => c[0] === 'stockfish_output')[1];
    handler({ type: 'info', score: { type: 'cp', value: 10 } });

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('info');
  });
});
