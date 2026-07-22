import React from 'react';
import { AlertTriangle, RefreshCw } from 'react-feather';

/**
 * ErrorBoundary — captures rendering errors from its children
 * and displays a fallback UI with a retry button.
 *
 * Props:
 *   children    — The components to guard.
 *   fallback    — Optional custom fallback element (default: board-style error).
 *   onError     — Optional callback fired with (error, errorInfo).
 *   componentName — Optional name shown in the error message.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error(
      `[ErrorBoundary${this.props.componentName ? ` – ${this.props.componentName}` : ''}]`,
      error,
      errorInfo
    );
    // Fire optional callback
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      const name = this.props.componentName || 'Chessboard';

      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="eb-icon" aria-hidden="true">
            <AlertTriangle size={28} />
          </div>
          <h3 className="eb-title">
            {name} failed to load
          </h3>
          <p className="eb-message">
            Something went wrong rendering this component. You can try again.
          </p>
          <button
            className="eb-retry-btn"
            onClick={this.handleRetry}
            aria-label={`Retry loading ${name}`}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
