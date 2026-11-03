import { render, screen } from '@testing-library/react';

// Mock Vercel Analytics and Speed Insights before importing App
jest.mock('@vercel/analytics/react', () => ({
  Analytics: () => null
}), { virtual: true });

jest.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: () => null
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

test('Landing page renders all six game mode cards', async () => {
  render(<App />);

  // All game mode cards from LandingScreen
  expect(screen.getByText('Analysis Mode')).toBeInTheDocument();
  expect(screen.getByText('Play Online')).toBeInTheDocument();
  expect(screen.getByText('Watch Live')).toBeInTheDocument();
  expect(screen.getByText('Tactics Trainer')).toBeInTheDocument();
  expect(screen.getByText('Puzzle Rush')).toBeInTheDocument();
  expect(screen.getByText('Game History')).toBeInTheDocument();
});

test('Landing page renders its content immediately, without a skeleton', async () => {
  render(<App />);

  // The landing screen should render within main element
  const main = document.querySelector('main');
  expect(main).toBeInTheDocument();
  expect(main).toHaveClass('landing-screen');

  // The landing page has no data dependency, so it must not withhold its
  // content behind a loading overlay or announce progress for work it is
  // not doing.
  expect(document.querySelector('.sk-landing-overlay')).not.toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();

  // The mode grid is present on first paint
  expect(document.querySelector('.landing-cards')).toBeInTheDocument();
});

test('Landing page has navigation elements with click handlers', async () => {
  render(<App />);

  // Game mode cards should have click handlers for navigation
  const analysisCard = screen.getByText('Analysis Mode');
  const onlineCard = screen.getByText('Play Online');
  const tacticsCard = screen.getByText('Tactics Trainer');
  const historyCard = screen.getByText('Game History');

  // All cards should be present as clickable elements
  expect(analysisCard).toBeInTheDocument();
  expect(onlineCard).toBeInTheDocument();
  expect(tacticsCard).toBeInTheDocument();
  expect(historyCard).toBeInTheDocument();
});
