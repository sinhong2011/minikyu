import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { saveCrashState } from '@/lib/recovery';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  showDetails: boolean;
  copied: boolean;
}

/**
 * Application-level error boundary with crash recovery and diagnostics.
 *
 * Captures unhandled React errors, persists crash data for debugging,
 * and renders a user-friendly fallback with recovery actions.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, showDetails: false, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Application crashed', {
      error: error.message,
      stack: error.stack,
    });

    this.setState({ errorInfo });
    this.saveCrashData(error, errorInfo);
  }

  private async saveCrashData(error: Error, errorInfo: ErrorInfo) {
    try {
      const appState = {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };

      await saveCrashState(appState, {
        error: error.message,
        stack: error.stack || 'No stack trace available',
        componentStack: errorInfo.componentStack || undefined,
      });
    } catch (saveError) {
      logger.error('Failed to save crash data', { saveError });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      showDetails: false,
      copied: false,
    });
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  private copyDiagnostics = () => {
    const { error, errorInfo } = this.state;
    if (!error) return;

    const diagnostics = [
      `Error: ${error.name}: ${error.message}`,
      '',
      `App Version: ${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'}`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      '',
      '--- Stack Trace ---',
      error.stack ?? 'No stack trace',
      '',
      '--- Component Stack ---',
      errorInfo?.componentStack ?? 'No component stack',
    ].join('\n');

    navigator.clipboard.writeText(diagnostics).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  private formatComponentStack(stack: string): string[] {
    return stack
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, showDetails, copied } = this.state;
    const errorName = error?.name ?? 'Error';
    const errorMessage = error?.message ?? 'An unexpected error occurred';

    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          background: 'radial-gradient(ellipse 120% 70% at 50% 0%, #1c1c23 0%, #09090b 65%)',
          color: '#fafafa',
        }}
      >
        {/* Card */}
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            background: '#111113',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '20px',
            boxShadow:
              '0 0 0 1px rgba(0,0,0,0.4), 0 24px 64px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}
        >
          {/* Card body */}
          <div style={{ padding: '36px 32px 28px' }}>
            {/* Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1
                style={{
                  fontSize: '17px',
                  fontWeight: 600,
                  margin: '0 0 6px 0',
                  letterSpacing: '-0.01em',
                  color: '#fafafa',
                }}
              >
                Something went wrong
              </h1>
              <p
                style={{
                  fontSize: '13px',
                  color: '#71717a',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                The application encountered an unexpected error.
                <br />
                Your data has been saved automatically.
              </p>
            </div>

            {/* Error badge */}
            <div
              style={{
                borderRadius: '10px',
                border: '1px solid rgba(239,68,68,0.15)',
                background: 'rgba(239,68,68,0.05)',
                padding: '10px 14px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#ef4444',
                  marginBottom: '3px',
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  letterSpacing: '0.02em',
                }}
              >
                {errorName}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#d4d4d8',
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                }}
              >
                {errorMessage}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: '#fafafa',
                  color: '#09090b',
                  letterSpacing: '-0.01em',
                  transition: 'opacity 120ms',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = '0.88';
                }}
                onFocus={(e) => {
                  e.currentTarget.style.opacity = '0.88';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Reload App
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#a1a1aa',
                  letterSpacing: '-0.01em',
                  transition: 'color 120ms, border-color 120ms',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = '#fafafa';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)';
                }}
                onFocus={(e) => {
                  e.currentTarget.style.color = '#fafafa';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = '#a1a1aa';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.color = '#a1a1aa';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                Try Again
              </button>
            </div>
          </div>

          {/* Diagnostics footer */}
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(0,0,0,0.2)',
            }}
          >
            <button
              type="button"
              onClick={this.toggleDetails}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: '#52525b',
                transition: 'color 120ms',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = '#a1a1aa';
              }}
              onFocus={(e) => {
                e.currentTarget.style.color = '#a1a1aa';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = '#52525b';
              }}
              onBlur={(e) => {
                e.currentTarget.style.color = '#52525b';
              }}
            >
              <span>Diagnostics</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {showDetails && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      this.copyDiagnostics();
                    }}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      background: 'rgba(255,255,255,0.06)',
                      color: copied ? '#4ade80' : '#71717a',
                      cursor: 'pointer',
                      transition: 'color 150ms',
                    }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: 'transform 150ms',
                    transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {showDetails && (
              <div
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  padding: '12px 16px',
                  maxHeight: '240px',
                  overflowY: 'auto',
                }}
              >
                {error?.stack && (
                  <div style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#3f3f46',
                        marginBottom: '6px',
                      }}
                    >
                      Stack Trace
                    </div>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '11px',
                        lineHeight: 1.6,
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                        color: '#52525b',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {error.stack}
                    </pre>
                  </div>
                )}

                {errorInfo?.componentStack && (
                  <div style={{ marginBottom: '12px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: '#3f3f46',
                        marginBottom: '6px',
                      }}
                    >
                      Component Stack
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {this.formatComponentStack(errorInfo.componentStack).map((line, i) => (
                        <span
                          key={`${i}:${line}`}
                          style={{
                            fontSize: '11px',
                            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                            color: '#52525b',
                          }}
                        >
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    fontSize: '10px',
                    color: '#3f3f46',
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                    paddingTop: '4px',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {typeof __APP_VERSION__ !== 'undefined' && <span>v{__APP_VERSION__}</span>}
                  <span>{new Date().toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
