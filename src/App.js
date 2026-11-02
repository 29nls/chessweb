import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './App.css';

// Import Layout & Pages
import AppLayout from './components/AppLayout';
import LandingScreen from './LandingScreen';

// Lazy-load heavy page components to reduce initial bundle size
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const OnlinePage = lazy(() => import('./pages/OnlinePage'));
const PuzzlePage = lazy(() => import('./pages/PuzzlePage'));
const PuzzleRushPage = lazy(() => import('./pages/PuzzleRushPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));

// ── 404 Not Found page ──
const NotFound = () => (
  <div className="not-found-page">
    <h1>404</h1>
    <p>This page doesn't exist.</p>
    <Link to="/" className="button-primary">Go Home</Link>
  </div>
);

// ── AnimatedRoutes: triggers a CSS transition on every route change ──
// Uses Suspense to show a fallback while lazy-loaded pages load
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <Suspense fallback={<div className="page-loading-fallback" aria-label="Loading" />}>
      <div className="page-enter" key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<LandingScreen />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/online" element={<OnlinePage />} />
          <Route path="/puzzles" element={<PuzzlePage />} />
          <Route path="/puzzle-rush" element={<PuzzleRushPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Suspense>
  );
};

function App() {
  return (
    <Router>
      <AppLayout>
        <AnimatedRoutes />
      </AppLayout>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
