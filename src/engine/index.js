// Engine facade: picks backend (Socket.IO) or in-browser WASM Stockfish.
// Exposes one interface so App.js is engine-agnostic:
//   { onConnect(cb), sendCommand(cmd), onOutput(cb), disconnect() }
//
// Mode is chosen by REACT_APP_ENGINE_MODE:
//   'browser' (default) -> self-contained, no backend (works on Vercel)
//   'backend'           -> original Socket.IO + Node backend
import { io } from 'socket.io-client';
import browserEngine from './browserEngine';
import { isGoCommand } from './uciUtil';

export function createEngine(mode = 'browser', backendUrl) {
  if (mode === 'backend') {
    const socket = io(backendUrl);
    const outputListeners = new Set();
    let searchIdCounter = 0;
    let currentSearchId = null;
    let isSearching = false;

    socket.on('stockfish_output', (d) =>
      outputListeners.forEach((l) => l({ ...d, searchId: d.searchId ?? currentSearchId }))
    );
    socket.on('stockfish_error', (e) =>
      outputListeners.forEach((l) => l({ type: 'error', message: e, searchId: currentSearchId }))
    );

    return {
      onConnect(cb) {
        socket.on('connect', cb);
      },
      sendCommand(cmd) {
        if (!socket.connected) return null;

        // Cancel any running search before starting a new one or switching positions.
        if (isGoCommand(cmd) && isSearching) {
          socket.emit('command', 'stop');
        }

        socket.emit('command', cmd);

        if (isGoCommand(cmd)) {
          isSearching = true;
          currentSearchId = ++searchIdCounter;
          return currentSearchId;
        }

        if (cmd === 'stop' || cmd === 'ucinewgame') {
          isSearching = false;
        }

        return null;
      },
      onOutput(cb) {
        outputListeners.add(cb);
        return () => outputListeners.delete(cb);
      },
      disconnect() {
        // Stop any active search before disconnecting to prevent the server
        // from continuing to analyze after the client leaves.
        if (isSearching && socket.connected) {
          socket.emit('command', 'stop');
          isSearching = false;
        }
        socket.disconnect();
        outputListeners.clear();
      },
    };
  }

  return {
    onConnect(cb) {
      return browserEngine.onReady(cb);
    },
    sendCommand(cmd) {
      return browserEngine.sendCommand(cmd);
    },
    onOutput(cb) {
      return browserEngine.onOutput(cb);
    },
    disconnect() {
      browserEngine.stop();
    },
  };
}
