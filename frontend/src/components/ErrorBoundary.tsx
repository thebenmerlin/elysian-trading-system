/**
 * Elysian Trading System - Enhanced Error Boundary Component
 */
import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }

  private handleRestart = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  }

  private handleHome = () => {
    window.location.href = '/';
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-terminal-bg text-terminal-primary p-8 font-mono">
          <div className="max-w-4xl mx-auto">
            <div className="border border-terminal-error p-6 rounded-lg">
              <h1 className="text-2xl font-bold text-terminal-error mb-4">
                🚨 SYSTEM FAULT DETECTED
              </h1>
              
              <div className="mb-6">
                <p className="text-terminal-muted mb-2">
                  The Elysian Trading System has encountered an unexpected error.
                </p>
                
                <div className="bg-black p-4 rounded border border-terminal-border">
                  <p className="text-terminal-error font-bold">Error Details:</p>
                  <p className="text-terminal-muted break-all">
                    {this.state.error?.message || 'Unknown system error'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mb-6">
                <button
                  onClick={this.handleRestart}
                  className="px-6 py-2 bg-terminal-primary text-black font-bold rounded hover:bg-terminal-secondary transition-colors"
                >
                  🔄 RESTART SYSTEM
                </button>
                
                <button
                  onClick={this.handleHome}
                  className="px-6 py-2 bg-terminal-secondary text-black font-bold rounded hover:bg-terminal-primary transition-colors"
                >
                  🏠 HOME TERMINAL
                </button>
              </div>

              <div className="text-sm text-terminal-muted">
                <p className="font-bold mb-2">If this error persists, please check:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Backend API connectivity</li>
                  <li>Network connection</li>
                  <li>Browser console for details</li>
                  <li>Environment variables configuration</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 text-xs text-terminal-muted">
              <p>Error occurred at: {new Date().toISOString()}</p>
              <p>Frontend: https://elysian-trading-system.vercel.app</p>
              <p>Backend: https://elysian-backend-bd3o.onrender.com</p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
