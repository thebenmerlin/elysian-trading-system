/**
 * Elysian Trading System - Trades Page
 * Trading history and statistics
 */

import React from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { apiClient, formatCurrency, formatDate, getStatusColor } from '@/utils/api'
import { Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react'

// ✅ Define data interfaces for type safety
interface Trade {
  id: string
  timestamp: string
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  executed_price: number
  status: string
  commission: number
}

interface TradeStats {
  total_trades: number
  buy_trades: number
  sell_trades: number
  total_volume: number
  avg_trade_size: number
  period_days: number
}

export default function Trades() {
  const { data: trades } = useQuery(
    'trades-history',
    () => apiClient.trades.getRecent(100),
    { refetchInterval: 30000 }
  )

  const { data: tradeStats } = useQuery(
    'trade-statistics',
    () => apiClient.trades.getStats(30),
    { refetchInterval: 60000 }
  )

  // ✅ Safe data extraction with type assertion
  const tradesData: Trade[] = (trades as any)?.data?.data || []
  const statsData: TradeStats | null = (tradeStats as any)?.data?.data || null

  const getTradeIcon = (side: string) => {
    return side === 'BUY' ? (
      <TrendingUp className="w-4 h-4 text-terminal-primary" />
    ) : (
      <TrendingDown className="w-4 h-4 text-terminal-error" />
    )
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-mono font-bold text-terminal-primary mb-2">
              TRADING HISTORY
            </h1>
            <p className="text-terminal-muted font-mono">
              Trade execution log and performance statistics
            </p>
          </div>
        </motion.div>

        {/* Trade Statistics */}
        {statsData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="metric-card">
              <div className="flex items-center space-x-2 mb-2">
                <Activity className="w-4 h-4 text-terminal-primary" />
                <span className="text-terminal-muted text-sm font-mono">TOTAL TRADES</span>
              </div>
              <div className="text-xl font-mono font-bold">
                {statsData.total_trades}
              </div>
              <div className="text-xs text-terminal-muted">
                {(statsData.total_trades / statsData.period_days).toFixed(1)} per day
              </div>
            </div>

            <div className="metric-card">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-terminal-primary" />
                <span className="text-terminal-muted text-sm font-mono">BUY TRADES</span>
              </div>
              <div className="text-xl font-mono font-bold text-terminal-primary">
                {statsData.buy_trades}
              </div>
              <div className="text-xs text-terminal-muted">
                {((statsData.buy_trades / statsData.total_trades) * 100).toFixed(1)}% of total
              </div>
            </div>

            <div className="metric-card">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingDown className="w-4 h-4 text-terminal-error" />
                <span className="text-terminal-muted text-sm font-mono">SELL TRADES</span>
              </div>
              <div className="text-xl font-mono font-bold text-terminal-error">
                {statsData.sell_trades}
              </div>
              <div className="text-xs text-terminal-muted">
                {((statsData.sell_trades / statsData.total_trades) * 100).toFixed(1)}% of total
              </div>
            </div>

            <div className="metric-card">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-terminal-primary">💰</span>
                <span className="text-terminal-muted text-sm font-mono">TOTAL VOLUME</span>
              </div>
              <div className="text-xl font-mono font-bold">
                {formatCurrency(statsData.total_volume)}
              </div>
              <div className="text-xs text-terminal-muted">
                Avg: {formatCurrency(statsData.avg_trade_size)}
              </div>
            </div>
          </div>
        )}

        {/* Trades Table */}
        <div className="terminal-window">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <div className="ml-4 text-terminal-muted text-sm font-mono">
              Trade Execution Log ({tradesData.length} trades)
            </div>
          </div>
          <div className="terminal-content">
            {tradesData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="terminal-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Executed Price</th>
                      <th>Value</th>
                      <th>Status</th>
                      <th>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradesData.map((trade) => (
                      <tr key={trade.id}>
                        <td className="text-xs">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(trade.timestamp)}</span>
                          </div>
                        </td>
                        <td className="font-bold text-terminal-primary">{trade.symbol}</td>
                        <td>
                          <div className="flex items-center space-x-1">
                            {getTradeIcon(trade.side)}
                            <span className={trade.side === 'BUY' ? 'text-terminal-primary' : 'text-terminal-error'}>
                              {trade.side}
                            </span>
                          </div>
                        </td>
                        <td>{trade.quantity.toLocaleString()}</td>
                        <td>{formatCurrency(trade.price)}</td>
                        <td>{formatCurrency(trade.executed_price)}</td>
                        <td>{formatCurrency(trade.quantity * trade.executed_price)}</td>
                        <td>
                          <span className={`status-indicator ${getStatusColor(trade.status)}`}>
                            {trade.status}
                          </span>
                        </td>
                        <td>{formatCurrency(trade.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-terminal-muted py-12">
                <div className="text-lg mb-2">📊</div>
                <div className="text-lg mb-2">No trades executed yet</div>
                <div className="text-sm">Start the trading runner to begin automated trading</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}