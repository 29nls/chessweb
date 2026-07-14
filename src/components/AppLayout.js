import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * AppLayout – Global layout wrapper.
 * Renders a consistent app header on every page except the root landing screen.
 */
const AppLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="app-shell">
      {!isHome && (
        <header className="App-header">
          <nav className="App-header-nav">
            <button
              onClick={() => navigate('/')}
              className="button-secondary"
              style={{ height: '40px' }}
              aria-label="Back to home"
            >
              ← Back to Home
            </button>
          </nav>
        </header>
      )}
      {children}
    </div>
  );
};

export default AppLayout;
