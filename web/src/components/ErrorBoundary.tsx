import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  title?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global and route-level Error Boundary to catch render errors gracefully
 * and prevent blank white screens in production or development.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React ErrorBoundary caught an exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public override render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error ?? new Error('Unknown error'), this.reset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="page narrow"
          style={{
            padding: '2rem 1rem',
            margin: '2rem auto',
            maxWidth: '680px',
          }}
        >
          <div
            className="card stack"
            style={{
              borderLeft: '4px solid #ef4444',
              background: '#ffffff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="row wrap" style={{ alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.8rem' }} role="img" aria-label="warning">
                ⚠️
              </span>
              <div>
                <h2 style={{ margin: 0, color: '#991b1b', fontSize: '1.25rem' }}>
                  {this.props.title || 'Something went wrong rendering this view'}
                </h2>
                <p className="muted small" style={{ margin: '0.2rem 0 0 0' }}>
                  An unexpected error occurred in the clinical application. The app prevented a blank screen.
                </p>
              </div>
            </div>

            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                padding: '0.8rem 1rem',
                fontSize: '0.9rem',
                color: '#991b1b',
                fontFamily: 'monospace',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error?.message || 'Unknown runtime error'}
            </div>

            <div className="row wrap" style={{ gap: '0.6rem', marginTop: '0.4rem' }}>
              <button
                type="button"
                className="btn primary"
                onClick={this.reset}
              >
                🔄 Try Again
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => window.location.reload()}
              >
                ↻ Reload Page
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.href = '/';
                  }
                }}
              >
                ← Go Back
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  window.location.href = '/';
                }}
              >
                🏠 Return to Dashboard
              </button>
            </div>

            {this.state.errorInfo?.componentStack && (
              <details style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: '#64748b' }}>
                <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                  Technical diagnostics & component trace
                </summary>
                <pre
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '0.6rem',
                    marginTop: '0.4rem',
                    overflowX: 'auto',
                    fontSize: '0.75rem',
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
