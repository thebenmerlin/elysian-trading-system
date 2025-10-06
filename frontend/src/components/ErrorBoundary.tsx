/**
 * Elysian Trading System - Error Boundary Component
 * Catches JavaScript errors in the component tree and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Elysian Error Boundary caught an error:', error, errorInfo)
    
    // You can log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-terminal-bg flex items-center justify-center p-6">
          <div className="terminal-window max-w-2xl w-full">
            <div className="terminal-header">
              <div className="terminal-dot red"></div>
              <div className="terminal-dot yellow"></div>
              <div className="terminal-dot green"></div>
              <div className="ml-4 text-terminal-muted text-sm font-mono">
                System Error
              </div>
            </div>
            
            <div className="terminal-content">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-terminal-error text-2xl font-mono font-bold mb-4">
                    ⚠️ SYSTEM FAULT DETECTED
                  </div>
                  
                  <div className="text-terminal-muted mb-6">
                    The Elysian Trading System has encountered an unexpected error.
                  </div>
                </div>

                <div className="bg-terminal-border bg-opacity-20 rounded p-4 text-sm font-mono">
                  <div className="text-terminal-warning mb-2">Error Details:</div>
                  <div className="text-terminal-muted break-all">
                    {this.state.error?.message || 'Unknown system error'}
                  </div>
                </div>

                <div className="space-y-2 text-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-terminal mr-4"
                  >
                    🔄 RESTART SYSTEM
                  </button>
                  
                  <button
                    onClick={() => window.location.href = '/'}
                    className="btn-terminal"
                  >
                    🏠 HOME TERMINAL
                  </button>
                </div>

                <div className="text-center text-terminal-muted text-xs mt-6">
                  <div>If this error persists, please check:</div>
                  <div>• Backend API connectivity</div>
                  <div>• Network connection</div>
                  <div>• Browser console for details</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Functional Error Boundary Hook (Alternative approach)
export function useErrorHandler() {
  return (error: Error, errorInfo: ErrorInfo) => {
    console.error('Error caught by error handler:', error, errorInfo)
    // Handle error reporting here
  }
}

export default ErrorBoundary
