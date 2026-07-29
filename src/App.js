import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './App.css';

// Import Layout & Pages
import AppLayout from './components/AppLayout';
import LandingScreen from './LandingScreen';
import AnalysisPage from './pages/AnalysisPage';
import OnlinePage from './pages/OnlinePage';
import PuzzlePage from './pages/PuzzlePage';
import PuzzleRushPage from './pages/PuzzleRushPage';
import HistoryPage from './pages/HistoryPage';

// ── 404 Not Found page ──
const NotFound = () => (
  <div className="not-found-page">
    <h1>404</h1>
    <p>This page doesn&apos;t exist.</p>
    <Link to="/" className="button-primary">Go Home</Link>
  </div>
);

// ── AnimatedRoutes: triggers a CSS transition on every route change ──
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
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