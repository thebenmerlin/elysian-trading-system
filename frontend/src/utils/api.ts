/**
 * Elysian Trading System - API Utilities (TYPE-SAFE COMPLETE VERSION)
 */

import axios from 'axios'
import type { AxiosResponse } from 'axios'

// ✅ Fix for Axios v1 TypeScript "data: unknown" issue
declare module 'axios' {
  export interface AxiosResponse<T = any> {
    data: T
  }
}

// --------------------------------------------------------
// ✅ CONFIGURATION
// --------------------------------------------------------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://elysian-backend-bd3o.onrender.com'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'elysian-demo-key'

console.log('🔧 API Configuration Initialized:', {
  API_BASE_URL,
  API_KEY_SET: !!API_KEY,
  API_KEY_PREFIX: API_KEY ? `${API_KEY.substring(0, 4)}...` : 'NONE',
  TIMESTAMP: new Date().toISOString()
})

// --------------------------------------------------------
// ✅ AXIOS INSTANCE
// --------------------------------------------------------

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'x-elysian-key': API_KEY
  }
})

// --------------------------------------------------------
// ✅ INTERCEPTORS
// --------------------------------------------------------

api.interceptors.request.use(
  (config) => {
    console.log('📡 API Request:', {
      url: `${config.baseURL}${config.url}`,
      method: config.method?.toUpperCase(),
      timestamp: new Date().toISOString()
    })
    return config
  },
  (error) => {
    console.error('❌ Request Setup Failed:', error)
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    console.log('✅ API Success:', {
      url: response.config.url,
      status: response.status,
      timestamp: new Date().toISOString()
    })
    return response
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      error_message: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    })

    return Promise.reject({
      ...error,
      safeData: {
        error: true,
        message: error.response?.data?.message || error.message,
        status: error.response?.status || 0,
        timestamp: new Date().toISOString()
      }
    })
  }
)

// --------------------------------------------------------
// ✅ TYPE INTERFACES
// --------------------------------------------------------

interface ApiResponse<T> {
  total_count?: number
  data: T
  message?: string
  success?: boolean
  timestamp?: string
}

interface PortfolioMetrics {
  total_return_pct: number
  sharpe_ratio: number
  max_drawdown_pct: number
  win_rate: number
}

interface PortfolioPosition {
  symbol: string
  quantity: number
  avg_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

interface PortfolioData {
  total_value: number
  cash: number
  positions_value: number
  daily_pnl: number
  total_pnl: number
  positions: PortfolioPosition[]
  metrics: PortfolioMetrics
}

// --------------------------------------------------------
// ✅ MAIN API CLIENT
// --------------------------------------------------------

export const apiClient = {
  // 🟩 Portfolio Endpoints
  portfolio: {
    getCurrent: async (): Promise<AxiosResponse<ApiResponse<PortfolioData>>> => {
      try {
        const response = await api.get<ApiResponse<PortfolioData>>('/api/portfolio')
        const portfolioData = response.data?.data || ({} as PortfolioData)

        return {
          data: {
            data: {
              total_value: portfolioData.total_value || 100000,
              cash: portfolioData.cash || 100000,
              positions_value: portfolioData.positions_value || 0,
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
            message: response.data?.message || 'OK',
            success: true,
            timestamp: response.data?.timestamp || new Date().toISOString()
          }
        } as AxiosResponse<ApiResponse<PortfolioData>>
      } catch (error: any) {
        console.error('Portfolio API failed:', error)
        return {
          data: {
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
            message: error.safeData?.message || 'Failed to fetch portfolio',
            success: false,
            timestamp: new Date().toISOString()
          }
        } as AxiosResponse<ApiResponse<PortfolioData>>
      }
    },

    getHistory: async (days: number = 30) => {
      try {
        const response = await api.get<ApiResponse<any>>(`/api/portfolio/history?days=${days}`)
        return { data: response.data?.data || [] }
      } catch {
        return { data: [], error: true }
      }
    },

    getMetrics: async () => {
      try {
        const response = await api.get<ApiResponse<PortfolioMetrics>>('/api/portfolio/metrics')
        return { data: response.data?.data || {} }
      } catch {
        return { data: {}, error: true }
      }
    }
  },

  // 🟦 Trades Endpoints
  trades: {
    getRecent: async (limit: number = 50) => {
      try {
        const response = await api.get<ApiResponse<any>>(`/api/trades?limit=${limit}`)
        return {
          data: Array.isArray(response.data?.data) ? response.data.data : [],
          total_count: response.data?.total_count || 0
        }
      } catch {
        return { data: [], total_count: 0, error: true }
      }
    },

    getStats: async (days: number = 30) => {
      try {
        const response = await api.get<ApiResponse<any>>(`/api/trades/stats?days=${days}`)
        return { data: response.data?.data || {} }
      } catch {
        return { data: {}, error: true }
      }
    }
  },

  // 🟧 Reflections Endpoints
  reflections: {
    getAll: async (limit: number = 10) => {
      try {
        const response = await api.get<ApiResponse<any>>(`/api/reflections?limit=${limit}`)
        return { data: response.data?.data || [] }
      } catch {
        return { data: [], error: true }
      }
    },
    generate: async (days: number = 7) => {
      try {
        const response = await api.post<ApiResponse<any>>('/api/reflections/generate', { days })
        return { data: response.data }
      } catch (error: any) {
        throw new Error(error.safeData?.message || 'Failed to generate reflection')
      }
    }
  },

  // 🟥 System Endpoints
  system: {
    getHealth: async () => {
      try {
        const response = await api.get<ApiResponse<any>>('/health')
        return {
          data: {
            status: response.data?.data?.status || 'unknown',
            database: response.data?.data?.database || 'unknown',
            timestamp: response.data?.data?.timestamp || new Date().toISOString()
          }
        }
      } catch {
        return {
          data: {
            status: 'unhealthy',
            database: 'disconnected',
            timestamp: new Date().toISOString()
          },
          error: true
        }
      }
    }
  }
}

// --------------------------------------------------------
// ✅ UTILITY HELPERS
// --------------------------------------------------------

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '0.00%'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '0'
  return new Intl.NumberFormat('en-US').format(value)
}

export const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A'
  try {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Invalid Date'
  }
}

export const getStatusColor = (status: string | null | undefined): string => {
  if (!status) return 'text-terminal-muted'
  switch (status.toLowerCase()) {
    case 'running':
    case 'healthy':
    case 'success':
    case 'connected':
      return 'text-terminal-primary'
    case 'stopped':
    case 'pending':
      return 'text-terminal-warning'
    case 'error':
    case 'failed':
    case 'unhealthy':
    case 'disconnected':
      return 'text-terminal-error'
    default:
      return 'text-terminal-muted'
  }
}

export const getPnLColor = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value))
    return 'text-terminal-muted'
  if (value > 0) return 'text-terminal-primary'
  if (value < 0) return 'text-terminal-error'
  return 'text-terminal-muted'
}

export default apiClient