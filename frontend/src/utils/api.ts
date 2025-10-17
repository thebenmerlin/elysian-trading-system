/**
 * Elysian Trading System - API Utilities
 * Type-safe API client without AxiosResponse dependencies
 */

import axios from 'axios'

// --------------------------------------------------------
// ✅ CONFIGURATION
// --------------------------------------------------------

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://elysian-backend-bd3o.onrender.com'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'elysian-demo-key'

console.log('🔧 API Configuration:', {
  API_BASE_URL,
  API_KEY_SET: !!API_KEY,
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
      method: config.method?.toUpperCase()
    })
    return config
  },
  (error) => {
    console.error('❌ Request Failed:', error)
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => {
    console.log('✅ API Success:', {
      url: response.config.url,
      status: response.status
    })
    return response
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    })
    return Promise.reject(error)
  }
)

// --------------------------------------------------------
// ✅ TYPE INTERFACES
// --------------------------------------------------------

// Generic API Response wrapper
interface ApiResponse<T> {
  data?: T
  message?: string
  success?: boolean
  timestamp?: string
  count?: number
  error?: string
}

// Asset Types
interface Asset {
  symbol: string
  asset_type: 'crypto' | 'equity'
  price: number
  volume: number
  change_24h: number
  last_updated: string
  data_source: string
}

// Signal Types
interface Signal {
  id: number
  symbol: string
  asset_type: 'crypto' | 'equity'
  signal_type: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string
  features?: any
  price_at_signal: number
  current_price?: number
  timestamp: string
  executed: boolean
}

// Trade Types
interface Trade {
  id: number
  symbol: string
  asset_type: 'crypto' | 'equity'
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  total_value: number
  reasoning: string
  confidence: number
  pnl_realized: number
  timestamp: string
}

// Portfolio Types
interface PortfolioPosition {
  symbol: string
  asset_type: 'crypto' | 'equity'
  quantity: number
  avg_price: number
  current_price: number
  market_value: number
  unrealized_pnl: number
  last_updated: string
}

interface PortfolioData {
  total_value: number
  cash_balance: number
  positions_value: number
  equity_value?: number
  crypto_value?: number
  total_pnl: number
  daily_pnl: number
  positions_count: number
  positions: PortfolioPosition[]
  metrics?: {
    total_return_pct?: number
    sharpe_ratio?: number
    max_drawdown_pct?: number
    win_rate?: number
  }
}

// System Event Types
interface SystemEvent {
  id: number
  event_type: string
  event_data: any
  severity: 'INFO' | 'WARN' | 'ERROR'
  timestamp: string
}

// Health Check Types
interface HealthData {
  status: string
  database: string
  websocket?: string
  ws_clients?: number
  timestamp: string
  version?: string
  uptime?: number
  environment?: string
}

// Market Status Types
interface MarketStatus {
  equity: {
    is_open: boolean
    trading_hours: string
  }
  crypto: {
    is_open: boolean
    trading_hours: string
  }
}

// Runner Status Types
interface RunnerStatus {
  is_running: boolean
  run_count?: number
  equity_run_count?: number
  crypto_run_count?: number
  system_health?: number
  config?: any
  equity_config?: any
  crypto_config?: any
}

// --------------------------------------------------------
// ✅ MAIN API CLIENT
// --------------------------------------------------------

export const apiClient = {
  // 🟦 Assets / Markets
  assets: {
    getLive: async (assetType?: 'crypto' | 'equity') => {
      try {
        const url = assetType ? `/api/assets/live?type=${assetType}` : '/api/assets/live'
        const response = await api.get<ApiResponse<Asset[]>>(url)
        return {
          data: Array.isArray(response.data?.data) ? response.data.data : [],
          error: false
        }
      } catch (error) {
        console.error('Assets API failed:', error)
        return { data: [] as Asset[], error: true }
      }
    }
  },

  // 🟨 Signals
  signals: {
    getRecent: async (limit: number = 15) => {
      try {
        const response = await api.get<ApiResponse<Signal[]>>(`/api/signals/recent?limit=${limit}`)
        return {
          data: Array.isArray(response.data?.data) ? response.data.data : [],
          error: false
        }
      } catch (error) {
        console.error('Signals API failed:', error)
        return { data: [] as Signal[], error: true }
      }
    }
  },

  // 🟩 Trades
  trades: {
    getRecent: async (limit: number = 20) => {
      try {
        const response = await api.get<ApiResponse<Trade[]>>(`/api/trades/recent?limit=${limit}`)
        return {
          data: Array.isArray(response.data?.data) ? response.data.data : [],
          error: false
        }
      } catch (error) {
        console.error('Trades API failed:', error)
        return { data: [] as Trade[], error: true }
      }
    }
  },

  // 💼 Portfolio
  portfolio: {
    getCurrent: async () => {
      try {
        const response = await api.get<ApiResponse<PortfolioData>>('/api/portfolio/live')
        const portfolioData = response.data?.data

        if (!portfolioData) {
          return {
            data: {
              total_value: 100000,
              cash_balance: 100000,
              positions_value: 0,
              total_pnl: 0,
              daily_pnl: 0,
              positions_count: 0,
              positions: [],
              metrics: {
                total_return_pct: 0,
                sharpe_ratio: 0,
                max_drawdown_pct: 0,
                win_rate: 0
              }
            },
            error: false
          }
        }

        return {
          data: {
            total_value: portfolioData.total_value || 100000,
            cash_balance: portfolioData.cash_balance || 100000,
            positions_value: portfolioData.positions_value || 0,
            equity_value: portfolioData.equity_value || 0,
            crypto_value: portfolioData.crypto_value || 0,
            total_pnl: portfolioData.total_pnl || 0,
            daily_pnl: portfolioData.daily_pnl || 0,
            positions_count: portfolioData.positions_count || 0,
            positions: Array.isArray(portfolioData.positions) ? portfolioData.positions : [],
            metrics: {
              total_return_pct: portfolioData.metrics?.total_return_pct || 0,
              sharpe_ratio: portfolioData.metrics?.sharpe_ratio || 0,
              max_drawdown_pct: portfolioData.metrics?.max_drawdown_pct || 0,
              win_rate: portfolioData.metrics?.win_rate || 0
            }
          },
          error: false
        }
      } catch (error) {
        console.error('Portfolio API failed:', error)
        return {
          data: {
            total_value: 100000,
            cash_balance: 100000,
            positions_value: 0,
            total_pnl: 0,
            daily_pnl: 0,
            positions_count: 0,
            positions: [],
            metrics: {
              total_return_pct: 0,
              sharpe_ratio: 0,
              max_drawdown_pct: 0,
              win_rate: 0
            }
          },
          error: true
        }
      }
    }
  },

  // 🔧 System
  system: {
    getHealth: async () => {
      try {
        const response = await api.get<HealthData>('/health')
        return {
          data: {
            status: response.data?.status || 'unknown',
            database: response.data?.database || 'unknown',
            websocket: response.data?.websocket || 'unknown',
            timestamp: response.data?.timestamp || new Date().toISOString()
          },
          error: false
        }
      } catch (error) {
        console.error('Health API failed:', error)
        return {
          data: {
            status: 'unhealthy',
            database: 'disconnected',
            timestamp: new Date().toISOString()
          },
          error: true
        }
      }
    },

    getEvents: async (limit: number = 50, severity?: string) => {
      try {
        const url = severity 
          ? `/api/system/events?limit=${limit}&severity=${severity}`
          : `/api/system/events?limit=${limit}`
        const response = await api.get<ApiResponse<SystemEvent[]>>(url)
        return {
          data: Array.isArray(response.data?.data) ? response.data.data : [],
          error: false
        }
      } catch (error) {
        console.error('Events API failed:', error)
        return { data: [] as SystemEvent[], error: true }
      }
    },

    getRunnerStatus: async () => {
      try {
        const response = await api.get<ApiResponse<RunnerStatus>>('/internal/runner/status')
        return {
          data: response.data?.data || {
            is_running: false,
            run_count: 0,
            equity_run_count: 0,
            crypto_run_count: 0,
            system_health: 1.0
          },
          error: false
        }
      } catch (error) {
        console.error('Runner Status API failed:', error)
        return {
          data: {
            is_running: false,
            run_count: 0,
            equity_run_count: 0,
            crypto_run_count: 0,
            system_health: 1.0
          },
          error: true
        }
      }
    },

    startRunner: async () => {
      try {
        const response = await api.post('/internal/runner/start')
        return { data: response.data, error: false }
      } catch (error) {
        console.error('Start Runner failed:', error)
        throw error
      }
    },

    stopRunner: async () => {
      try {
        const response = await api.post('/internal/runner/stop')
        return { data: response.data, error: false }
      } catch (error) {
        console.error('Stop Runner failed:', error)
        throw error
      }
    },

    runCycle: async () => {
      try {
        const response = await api.post('/internal/runner/cycle')
        return { data: response.data, error: false }
      } catch (error) {
        console.error('Run Cycle failed:', error)
        throw error
      }
    }
  },

  // 🔍 Market Status
  market: {
    getStatus: async () => {
      try {
        const response = await api.get<ApiResponse<MarketStatus>>('/api/market/status')
        return {
          data: response.data?.data || {
            equity: { is_open: false, trading_hours: '9:30 AM - 4:00 PM EST' },
            crypto: { is_open: true, trading_hours: '24/7' }
          },
          error: false
        }
      } catch (error) {
        console.error('Market Status API failed:', error)
        return {
          data: {
            equity: { is_open: false, trading_hours: '9:30 AM - 4:00 PM EST' },
            crypto: { is_open: true, trading_hours: '24/7' }
          },
          error: true
        }
      }
    }
  },

  // 🧪 Test Trade
  test: {
    executeTrade: async () => {
      try {
        const response = await api.post('/api/test/trade')
        return { data: response.data, error: false }
      } catch (error) {
        console.error('Test Trade failed:', error)
        return {
          data: {
            success: false,
            message: 'Test trade execution failed'
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '0.00%'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export const formatNumber = (value: number | null | undefined, decimals: number = 0): string => {
  if (value === null || value === undefined || isNaN(value)) return '0'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
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

export const formatTime = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A'
  try {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return 'Invalid Time'
  }
}

export const getStatusColor = (status: string | null | undefined): string => {
  if (!status) return 'text-[#9ca3af]'
  switch (status.toLowerCase()) {
    case 'running':
    case 'healthy':
    case 'success':
    case 'connected':
    case 'active':
      return 'text-[#10b981]'
    case 'stopped':
    case 'pending':
    case 'warning':
      return 'text-[#f59e0b]'
    case 'error':
    case 'failed':
    case 'unhealthy':
    case 'disconnected':
      return 'text-[#ef4444]'
    default:
      return 'text-[#9ca3af]'
  }
}

export const getPnLColor = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return 'text-[#9ca3af]'
  if (value > 0) return 'text-[#10b981]'
  if (value < 0) return 'text-[#ef4444]'
  return 'text-[#9ca3af]'
}

export const getConfidenceColor = (confidence: number | null | undefined): string => {
  if (confidence === null || confidence === undefined || isNaN(confidence)) return 'text-[#9ca3af]'
  if (confidence >= 0.7) return 'text-[#10b981]'
  if (confidence >= 0.5) return 'text-[#f59e0b]'
  return 'text-[#9ca3af]'
}

export const getChangeIcon = (change: number | null | undefined): string => {
  if (change === null || change === undefined || isNaN(change)) return '●'
  if (change > 0) return '▲'
  if (change < 0) return '▼'
  return '●'
}

// Export types for use in components
export type { 
  Asset, 
  Signal, 
  Trade, 
  PortfolioData, 
  PortfolioPosition, 
  SystemEvent, 
  HealthData,
  MarketStatus,
  RunnerStatus
}

// Default export
export default apiClient
