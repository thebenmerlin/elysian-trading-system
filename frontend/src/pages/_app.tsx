/**
 * Elysian Trading System - Main App Component
 */

import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from '@/components/ErrorBoundary'
import '@/styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-terminal-bg text-terminal-primary font-mono">
          <Component {...pageProps} />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#000',
                color: '#00FF9C',
                border: '1px solid #333',
                fontFamily: 'monospace',
              },
              success: {
                iconTheme: {
                  primary: '#00FF9C',
                  secondary: '#000',
                },
              },
              error: {
                iconTheme: {
                  primary: '#FF5757',
                  secondary: '#000',
                },
              },
            }}
          />
        </div>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
