/**
 * Elysian Trading System - API Utilities
 */

import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'elysian-demo-key'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-elysian-key': API_KEY
  }
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// API endpoints
export const apiClient = {
  // Portfolio endpoints
  portfolio: {
    getCurrent: () => api.get('/api/portfolio'),
    getHistory: (days: number = 30) => api.get(`/api/portfolio/history?days=${days}`),
    getMetrics: () => api.get('/api/portfolio/metrics'),
    getPositions: () => api.get('/api/portfolio/positions'),
    createSnapshot: () => api.post('/api/portfolio/snapshot')
  },

  // Trades endpoints
  trades: {
    getRecent: (limit: number = 50) => api.get(`/api/trades?limit=${limit}`),
    getStats: (days: number = 30) => api.get(`/api/trades/stats?days=${days}`),
    getById: (id: string) => api.get(`/api/trades/${id}`)
  },

  // Reports endpoints
  reports: {
    getLatest: () => api.get('/api/reports/latest'),
    getHistory: (limit: number = 10) => api.get(`/api/reports/history?limit=${limit}`),
    generate: (days: number = 30) => api.post('/api/reports/generate', { days }),
    getById: (id: string) => api.get(`/api/reports/${id}`)
  },

  // Reflections endpoints
  reflections: {
    getAll: (limit: number = 10) => api.get(`/api/reflections?limit=${limit}`),
    getLatest: () => api.get('/api/reflections/latest'),
    generate: (days: number = 7) => api.post('/api/reflections/generate', { days }),
    getById: (id: string) => api.get(`/api/reflections/${id}`)
  },

  // Internal/System endpoints
  system: {
    getHealth: () => api.get('/internal/health'),
    getRunnerStatus: () => api.get('/internal/runner/status'),
    getRunnerHistory: (limit: number = 20) => api.get(`/internal/runner/history?limit=${limit}`),
    startRunner: () => api.post('/internal/runner/start'),
    stopRunner: () => api.post('/internal/runner/stop'),
    runCycle: () => api.post('/internal/runner/cycle'),
    updateConfig: (config: any) => api.put('/internal/runner/config', config)
  }
}

// Helper functions
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value)
}

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const formatTime = (date: string | Date): string => {
  return new Date(date).toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Status color helpers
export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'running':
    case 'healthy':
    case 'success':
    case 'filled':
      return 'text-terminal-primary'
    case 'stopped':
    case 'pending':
      return 'text-terminal-warning'
    case 'error':
    case 'failed':
    case 'rejected':
    case 'unhealthy':
      return 'text-terminal-error'
    default:
      return 'text-terminal-muted'
  }
}

export const getPnLColor = (value: number): string => {
  if (value > 0) return 'text-terminal-primary'
  if (value < 0) return 'text-terminal-error'
  return 'text-terminal-muted'
}

export default apiClient
