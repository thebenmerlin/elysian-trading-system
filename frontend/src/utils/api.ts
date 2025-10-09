/**
 * Elysian Trading System - API Utilities (BULLETPROOF VERSION)
 */
import axios from 'axios'

// Enhanced API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://elysian-backend-bd3o.onrender.com'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'elysian-demo-key'

console.log('🔧 API Configuration Initialized:', { 
  API_BASE_URL, 
  API_KEY_SET: !!API_KEY,
  API_KEY_PREFIX: API_KEY ? `${API_KEY.substring(0,4)}...` : 'NONE',
  TIMESTAMP: new Date().toISOString()
});

// Create axios instance with bulletproof configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-elysian-key': API_KEY
  }
});

// Enhanced request interceptor
api.interceptors.request.use(
  (config) => {
    console.log('📡 API Request:', {
      url: `${config.baseURL}${config.url}`,
      method: config.method?.toUpperCase(),
      headers: {
        'x-elysian-key': config.headers['x-elysian-key'] ? 
          `${config.headers['x-elysian-key'].substring(0,4)}...` : 'NONE'
      },
      timestamp: new Date().toISOString()
    });
    return config;
  },
  (error) => {
    console.error('❌ Request Setup Failed:', error);
    return Promise.reject(error);
  }
);

// Bulletproof response interceptor
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Success:', {
      url: response.config.url,
      status: response.status,
      data_keys: response.data ? Object.keys(response.data) : [],
      timestamp: new Date().toISOString()
    });
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      error_message: error.response?.data?.message || error.message,
      response_data: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    // Return a safe error structure
    return Promise.reject({
      ...error,
      safeData: {
        error: true,
        message: error.response?.data?.message || error.message,
        status: error.response?.status || 0,
        timestamp: new Date().toISOString()
      }
    });
  }
);

// Bulletproof API client with safe defaults
export const apiClient = {
  // Portfolio endpoints with safe defaults
  // Portfolio endpoints with correct response handling
portfolio: {
  getCurrent: async () => {
    try {
      const response = await api.get('/api/portfolio');
      console.log('✅ Portfolio API Response:', response.data);
      
      // The backend returns: { data: {...}, timestamp: "..." }
      // We need to restructure it for the frontend
      const portfolioData = response.data.data; // Extract the nested data
      
      return {
        data: {
          total_value: portfolioData.total_value || 100000,
          cash: portfolioData.cash_balance || portfolioData.cash || 100000,
          positions_value: portfolioData.invested_amount || 0,
          daily_pnl: portfolioData.daily_pnl || 0,
          total_pnl: portfolioData.total_pnl || 0,
          positions: portfolioData.positions || [],
          metrics: {
            total_return_pct: portfolioData.metrics?.total_return_pct || 0,
            sharpe_ratio: portfolioData.metrics?.sharpe_ratio || 0,
            max_drawdown_pct: portfolioData.metrics?.max_drawdown_pct || 0,
            win_rate: portfolioData.metrics?.win_rate || 0
          }
        },
        timestamp: response.data.timestamp || new Date().toISOString()
      };
    } catch (error: any) {
      console.error('Portfolio API failed:', error);
      return {
        data: {
          total_value: 100000,
          cash: 100000,
          positions_value: 0,
          daily_pnl: 0,
          total_pnl: 0,
          positions: [],
          metrics: {
            total_return_pct: 0,
            sharpe_ratio: 0,
            max_drawdown_pct: 0,
            win_rate: 0
          }
        },
        error: true,
        message: error.safeData?.message || 'Failed to fetch portfolio',
        timestamp: new Date().toISOString()
      };
    }
  },
  // ... rest of portfolio methods stay the same
},

  // Trades endpoints with safe defaults
  trades: {
    getRecent: async (limit: number = 50) => {
      try {
        const response = await api.get(`/api/trades?limit=${limit}`);
        return { 
          data: Array.isArray(response.data?.data) ? response.data.data : [],
          total_count: response.data?.total_count || 0
        };
      } catch (error) {
        return { 
          data: [], 
          total_count: 0, 
          error: true 
        };
      }
    },
    getStats: async (days: number = 30) => {
      try {
        const response = await api.get(`/api/trades/stats?days=${days}`);
        return { data: response.data || {} };
      } catch (error) {
        return { data: {}, error: true };
      }
    }
  },

  // Reflections endpoints with safe defaults
  reflections: {
    getLatest: async () => {
      try {
        const response = await api.get('/api/reflections/latest');
        return { 
          data: response.data?.data || null 
        };
      } catch (error) {
        return { 
          data: null, 
          error: true 
        };
      }
    }
  },

  // System endpoints with safe defaults
  system: {
    // System endpoints with correct response handling  
system: {
  getHealth: async () => {
    try {
      const response = await api.get('/health');
      console.log('✅ Health API Response:', response.data);
      
      return { 
        data: {
          status: response.data?.status || 'unknown',
          database: response.data?.database || 'unknown', 
          timestamp: response.data?.timestamp || new Date().toISOString(),
          components: {
            database: response.data?.database || 'unknown',
            trading_runner: { 
              status: response.data?.runner_status || 'unknown' 
            }
          }
        }
      };
    } catch (error) {
      console.error('Health API failed:', error);
      return { 
        data: {
          status: 'unhealthy',
          database: 'disconnected',
          components: {
            database: 'disconnected',
            trading_runner: { status: 'unknown' }
          },
          error: true
        }
      };
    }
  },
  // ... rest of system methods stay the same
},
    getRunnerStatus: async () => {
      try {
        const response = await api.get('/internal/runner/status');
        return { 
          data: {
            is_running: response.data?.data?.is_running || false,
            run_count: response.data?.data?.run_count || 0,
            config: response.data?.data?.config || {}
          }
        };
      } catch (error) {
        return { 
          data: {
            is_running: false,
            run_count: 0,
            config: {}
          },
          error: true
        };
      }
    },
    startRunner: async () => {
      try {
        const response = await api.post('/internal/runner/start');
        return { data: response.data };
      } catch (error: any) {
        throw new Error(error.safeData?.message || 'Failed to start runner');
      }
    },
    stopRunner: async () => {
      try {
        const response = await api.post('/internal/runner/stop');
        return { data: response.data };
      } catch (error: any) {
        throw new Error(error.safeData?.message || 'Failed to stop runner');
      }
    },
    runCycle: async () => {
      try {
        const response = await api.post('/internal/runner/cycle');
        return { data: response.data };
      } catch (error: any) {
        throw new Error(error.safeData?.message || 'Failed to run cycle');
      }
    }
  }
};

// Bulletproof helper functions with null safety
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
  if (!date) return 'N/A';
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

export const getStatusColor = (status: string | null | undefined): string => {
  if (!status || typeof status !== 'string') {
    return 'text-terminal-muted';
  }
  
  switch (status.toLowerCase()) {
    case 'running':
    case 'healthy':
    case 'success':
    case 'connected':
      return 'text-terminal-primary';
    case 'stopped':
    case 'pending':
      return 'text-terminal-warning';
    case 'error':
    case 'failed':
    case 'unhealthy':
    case 'disconnected':
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
