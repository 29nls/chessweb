// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom does not provide TextEncoder/TextDecoder, but react-router v7 uses
// them internally. Expose them globally before any test imports the router.
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

// Mock window.matchMedia for JSDOM (used by AppLayout dark mode)
window.matchMedia = window.matchMedia || (() => ({
  matches: false,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
}));

// Mock localStorage for tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// jsdom does not implement ResizeObserver, which react-chessboard (v5) uses
// for responsive board sizing. Without this, rendering <App /> throws.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom does not implement IntersectionObserver, which LandingScreen uses
// for animated counters and scroll-reveal effects.
global.IntersectionObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
};
