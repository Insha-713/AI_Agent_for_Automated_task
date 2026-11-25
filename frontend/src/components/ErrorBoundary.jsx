import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AgentFlow ErrorBoundary caught an exception]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-3xl mx-auto my-12 p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-rose-500/30 shadow-2xl backdrop-blur-md space-y-5">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white font-display">Page Execution Notice</h2>
              <p className="text-xs text-slate-400">
                A rendering exception occurred in this module. The application remains active and safe.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-white/5 font-mono text-xs text-rose-300 overflow-x-auto max-h-40">
            {this.state.error?.message || 'Unknown render exception'}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry / Recover Component</span>
            </button>
            {this.props.onNavigate && (
              <button
                type="button"
                onClick={() => {
                  this.handleReset();
                  this.props.onNavigate('dashboard');
                }}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all"
              >
                <Home className="w-4 h-4 text-cyan-400" />
                <span>Return to Dashboard</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
