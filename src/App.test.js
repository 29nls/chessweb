import { render, screen } from '@testing-library/react';
import App from './App';

// jsdom has no Worker global; stub it so the engine facade can initialize
// without crashing during mount (App creates the engine in a useEffect).
class StubWorker {
  postMessage() {}
  terminate() {}
  set onmessage(_) {}
  set onerror(_) {}
}
global.Worker = StubWorker;

test('App mounts, shows the loading screen, then the chess UI', async () => {
  render(<App />);

  // Initial loading state renders synchronously (single element, early return).
  expect(screen.getByText('Loading...')).toBeInTheDocument();

  // After the loading delay the full app (incl. lazy board) mounts.
  // 2500ms > the 1500ms loading delay, and exercises the ResizeObserver path.
  expect(await screen.findByText('ChessWeb', {}, { timeout: 2500 })).toBeInTheDocument();
});
