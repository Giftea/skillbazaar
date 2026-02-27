import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(err: Error) {
    console.error('[SkillBazaar] Uncaught error:', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '40px 24px', maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              Something went wrong
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
              An unexpected error occurred. Try refreshing the page.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="pay-btn"
              style={{ maxWidth: 200, margin: '0 auto' }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
