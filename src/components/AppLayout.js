import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon } from 'react-feather';

/**
 * AppLayout – Global layout wrapper.
 * Renders a consistent app header on every page except the root landing screen.
 */
const AppLayout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Dark mode state
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('chessweb_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('chessweb_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="App-header">
        <nav className="App-header-nav" aria-label="Primary navigation">
          {!isHome && (
            <button
              onClick={() => navigate('/')}
              className="button-secondary nav-back-btn"
              aria-label="Back to home"
            >
              <span aria-hidden="true">← </span>Back to Home
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="button-secondary nav-theme-btn"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </header>
      <div id="main-content" tabIndex={-1} className="app-main">
        {children}
      </div>
    </div>
  );
};

export default AppLayout;
