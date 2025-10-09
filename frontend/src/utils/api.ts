/**
 * Elysian Trading System - API Utilities
 */
import axios from 'axios'

// API Configuration with proper error handling
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://elysian-backend-bd3o.onrender.com'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'elysian-demo-key'

console.log('🔧 API Configuration:', { 
  API_BASE_URL, 
  API_KEY_SET: !!API_KEY,
  TIMESTAMP: new Date().toISOString()
});

// Create axios instance with comprehensive error handling
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-elysian-key': API_KEY
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log('📡 API Request:', {
      url: `${config.baseURL}${config.url}`,
      method: config.method?.toUpperCase(),
      timestamp: new Date().toISOString()
    });
    return config;
  },
  (error) => {
    console.error('❌ Request Setup Failed:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with enhanced error handling
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Success:', {
      url: response.config.url,
      status: response.status,
      timestamp: new Date().toISOString()
    });
    return response;
  },
  (error) => {
    console.error('❌ API Error Details:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    });
    
    // Create user-friendly error
    const friendlyError = {
      ...error,
      userMessage: getUserFriendlyError(error)
    };
    
    return Promise.reject(friendlyError);
  }
);

// Helper function for user-friendly errors
const getUserFriendlyError = (error: any): string => {
  if (error.response?.status === 401) {
    return '🔑 Authentication failed - invalid API key';
  } else if (error.response?.status === 404) {
    return '🔍 API endpoint not found';
  } else if (error.response?.status === 500) {
    return '🔧 Backend server error';
  } else if (error.message?.includes('CORS')) {
    return '🚫 Cross-origin request blocked';
  } else if (error.message?.includes('Network Error') || error.code === 'ECONNABORTED') {
    return '🌐 Cannot reach backend server';
  } else {
    return '⚠️ Unexpected error occurred';
  }
};

// API endpoints with proper error handling
export const apiClient = {
  // Portfolio endpoints
  portfolio: {
    getCurrent: () => api.get('/api/portfolio').catch(error => {
      console.error('Portfolio fetch failed:', error);
      throw error;
    }),
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

  // System endpoints
  system: {
    getHealth: () => api.get('/health'),
    getRunnerStatus: () => api.get('/internal/runner/status'),
    getRunnerHistory: (limit: number = 20) => api.get(`/internal/runner/history?limit=${limit}`),
    startRunner: () => api.post('/internal/runner/start'),
    stopRunner: () => api.post('/internal/runner/stop'),
    runCycle: () => api.post('/internal/runner/cycle'),
    updateConfig: (config: any) => api.put('/internal/runner/config', config)
  }
}

// Helper functions with null safety
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00%';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('en-US').format(value);
}

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) {
    return 'N/A';
  }
  try {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid Date';
  }
}

export const formatTime = (date: string | Date | null | undefined): string => {
  if (!date) {
    return 'N/A';
  }
  try {
    return new Date(date).toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    return 'Invalid Time';
  }
}

// Status color helpers with null safety
export const getStatusColor = (status: string | null | undefined): string => {
  if (!status || typeof status !== 'string') {
    return 'text-terminal-muted';
  }
  
  switch (status.toLowerCase()) {
    case 'running':
    case 'healthy':
    case 'success':
    case 'filled':
      return 'text-terminal-primary';
    case 'stopped':
    case 'pending':
      return 'text-terminal-warning';
    case 'error':
    case 'failed':
    case 'rejected':
    case 'unhealthy':
      return 'text-terminal-error';
    default:
      return 'text-terminal-muted';
  }
}

export const getPnLColor = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return 'text-terminal-muted';
  }
  if (value > 0) return 'text-terminal-primary';
  if (value < 0) return 'text-terminal-error';
  return 'text-terminal-muted';
}

export default apiClient
