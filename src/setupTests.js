// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom does not implement ResizeObserver, which react-chessboard (v5) uses
// for responsive board sizing. Without this, rendering <App /> throws.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
