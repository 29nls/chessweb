import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Sun, Moon } from 'react-feather';

/**
 * AppLayout - global layout wrapper.
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

  // Back goes to the previous screen when there is one, and home when the route
  // was opened directly. The wordmark now covers going home, so this no longer
  // duplicates it.
  const goBack = () => {
    const idx = window.history.state?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="App-header">
        <nav className="App-header-nav" aria-label="Primary navigation">
          {/* Real text, in a link home. This was generated content before, which
              cannot be selected, translated or found by in-page search, and left
              the header without an accessible brand element.
              On the landing screen the h1 already says ChessWeb, so repeating it
              here would give the page two identical accessible names. */}
          {isHome ? (
            <span className="App-header-spacer" aria-hidden="true" />
          ) : (
            <Link to="/" className="App-header-wordmark">
              ChessWeb
            </Link>
          )}
          <div className="App-header-actions">
            {!isHome && (
              <button
                onClick={goBack}
                className="button-secondary nav-back-btn"
                aria-label="Go back"
              >
                <span aria-hidden="true">←</span> Back
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
          </div>
        </nav>
      </header>
      <div id="main-content" tabIndex={-1} className="app-main">
        {children}
      </div>
    </div>
  );
};

export default AppLayout;
