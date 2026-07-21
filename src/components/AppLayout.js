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
      <header className="App-header">
        <nav className="App-header-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isHome && (
            <button
              onClick={() => navigate('/')}
              className="button-secondary"
              style={{ height: '40px' }}
              aria-label="Back to home"
            >
              ← Back to Home
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="button-secondary"
            style={{
              height: '40px',
              width: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: isHome ? 'auto' : 'auto',
            }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
};

export default AppLayout;
