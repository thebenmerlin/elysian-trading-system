/**
 * Elysian Trading System - API Utilities
 */
import axios from 'axios'

// Enhanced API URL resolution with fallbacks and debugging
const getApiBaseUrl = (): string => {
  // Priority 1: Environment variable
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    console.log('Using API URL from env:', envUrl);
    return envUrl;
  }
  
  // Priority 2: Production fallback  
  if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
    const prodUrl = 'https://elysian-backend-bd3o.onrender.com'; // Actual backend URL
    console.log('Using production fallback API URL:', prodUrl);
    return prodUrl;
  }
  
  // Priority 3: Development fallback
  const devUrl = 'http://localhost:4000';
  console.log('Using development fallback API URL:', devUrl);
  return devUrl;
};

const API_BASE_URL = getApiBaseUrl();
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'elysian-demo-key';

console.log('API Configuration:', { API_BASE_URL, API_KEY_SET: !!API_KEY });

// Create axios instance with enhanced error handling
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-elysian-key': API_KEY
  }
});

// Enhanced request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('Making API request:', {
      url: `${config.baseURL}${config.url}`,
      method: config.method?.toUpperCase(),
      headers: config.headers
    });
    return config;
  },
  (error) => {
    console.error('API request setup failed:', error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('API response received:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('API Error Details:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      cors: error.message?.includes('CORS'),
      network: error.message?.includes('Network Error')
    });
    
    // Provide helpful error messages
    if (error.response?.status === 401) {
      console.error('🔑 Authentication failed - check your API key');
    } else if (error.response?.status === 404) {
      console.error('🔍 API endpoint not found - check your API URL');
    } else if (error.message?.includes('CORS')) {
      console.error('🚫 CORS error - check backend CORS configuration');
    } else if (error.message?.includes('Network Error')) {
      console.error('🌐 Network error - backend may be down or URL incorrect');
    }
    
    return Promise.reject(error);
  }
);

// Keep all your existing API client methods exactly the same...
export const apiClient = {
  // Portfolio endpoints
  portfolio: {
    getCurrent: () => api.get('/api/portfolio'),
    getHistory: (days: number = 30) => api.get(`/api/portfolio/history?days=${days}`),
    getMetrics: () => api.get('/api/portfolio/metrics'),
    getPositions: () => api.get('/api/portfolio/positions'),
    createSnapshot: () => api.post('/api/portfolio/snapshot')
  },
  
  // ... rest of your existing API methods remain the same
  
  // System endpoints
  system: {
    getHealth: () => api.get('/health'), // Note: no /api prefix for health
    getRunnerStatus: () => api.get('/internal/runner/status'),
    getRunnerHistory: (limit: number = 20) => api.get(`/internal/runner/history?limit=${limit}`),
    startRunner: () => api.post('/internal/runner/start'),
    stopRunner: () => api.post('/internal/runner/stop'),
    runCycle: () => api.post('/internal/runner/cycle'),
    updateConfig: (config: any) => api.put('/internal/runner/config', config)
  }
};

// Keep all your existing helper functions...
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

// ... rest of your helper functions

export default apiClient
