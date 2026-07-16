import { render, screen } from '@testing-library/react';

// Mock Vercel Analytics before importing App
jest.mock('@vercel/analytics/react', () => ({
  Analytics: () => null
}), { virtual: true });

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

test('App mounts and shows the landing screen', async () => {
  render(<App />);

  // Landing screen renders immediately with the ChessWeb heading
  expect(screen.getByText('ChessWeb')).toBeInTheDocument();

  // The three game-mode cards are present
  expect(screen.getByText('Analysis Mode')).toBeInTheDocument();
  expect(screen.getByText('Play Online')).toBeInTheDocument();
  expect(screen.getByText('Watch Live')).toBeInTheDocument();
});
