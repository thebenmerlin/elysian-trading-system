/**
 * Trades Page - Standalone Version
 * Can be accessed at /trades
 */
import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import Layout from '@/components/Layout'
import { apiClient, formatCurrency, formatDate, getPnLColor } from '@/utils/api'
import { TrendingUp, TrendingDown, Filter, Download } from 'lucide-react'

export default function TradesPage() {
  const [activeTab, setActiveTab] = useState('trades')
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'CRYPTO' | 'EQUITY'>('ALL')

  // Fetch trades
  const { data: tradesResponse, isLoading } = useQuery(
    'trades-page',
    () => apiClient.trades.getRecent(50),
    { refetchInterval: 10000, retry: 1 }
  )

  const allTrades = tradesResponse?.data || []

  // Filter trades
  const filteredTrades = allTrades.filter((trade: any) => {
    if (filter === 'ALL') return true
    if (filter === 'BUY') return trade.side === 'BUY'
    if (filter === 'SELL') return trade.side === 'SELL'
    if (filter === 'CRYPTO') return trade.asset_type === 'crypto'
    if (filter === 'EQUITY') return trade.asset_type === 'equity'
    return true
  })

  // Calculate stats
  const totalPnL = allTrades.reduce((sum: number, t: any) => sum + (t.pnl_realized || 0), 0)
  const buyCount = allTrades.filter((t: any) => t.side === 'BUY').length
  const sellCount = allTrades.filter((t: any) => t.side === 'SELL').length
  const cryptoCount = allTrades.filter((t: any) => t.asset_type === 'crypto').length
  const equityCount = allTrades.filter((t: any) => t.asset_type === 'equity').length

  if (isLoading) {
    return (
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="flex items-center justify-center h-full">
          <div className="text-[#9ca3af] text-lg">Loading trades...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-4">
            <div className="text-xs text-[#9ca3af] mb-1">Total Trades</div>
            <div className="text-2xl font-bold text-[#f3f4f6]">{allTrades.length}</div>
          </div>
          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-4">
            <div className="text-xs text-[#9ca3af] mb-1">Buy Orders</div>
            <div className="text-2xl font-bold text-[#10b981]">{buyCount}</div>
          </div>
          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-4">
            <div className="text-xs text-[#9ca3af] mb-1">Sell Orders</div>
            <div className="text-2xl font-bold text-[#ef4444]">{sellCount}</div>
          </div>
          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-4">
            <div className="text-xs text-[#9ca3af] mb-1">Realized P&L</div>
            <div className={`text-2xl font-bold ${getPnLColor(totalPnL)}`}>
              {formatCurrency(totalPnL)}
            </div>
          </div>
          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-4">
            <div className="text-xs text-[#9ca3af] mb-1">Asset Split</div>
            <div className="text-sm font-bold text-[#f3f4f6]">
              {cryptoCount}C / {equityCount}E
            </div>
          </div>
        </div>

        {/* Trades Table */}
        <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] overflow-hidden">
          {/* Header with Filters */}
          <div className="px-6 py-4 border-b border-[#1f2937] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#f3f4f6]">Trade History</h2>
            <div className="flex gap-2">
              {['ALL', 'BUY', 'SELL', 'CRYPTO', 'EQUITY'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                    filter === f
                      ? 'bg-[#3b82f6] text-white'
                      : 'bg-[#1f2937] text-[#9ca3af] hover:bg-[#374151]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a0b0d]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9ca3af] uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9ca3af] uppercase">Symbol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9ca3af] uppercase">Side</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase">Quantity</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase">Total Value</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase">Realized P&L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#9ca3af] uppercase">Reasoning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2937]">
                {filteredTrades.map((trade: any, index: number) => (
                  <motion.tr
                    key={trade.id || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="hover:bg-[#1f2937]/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-[#9ca3af]">
                      {formatDate(trade.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#f3f4f6]">{trade.symbol}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          trade.asset_type === 'crypto' 
                            ? 'bg-yellow-500/10 text-yellow-500' 
                            : 'bg-blue-500/10 text-blue-500'
                        }`}>
                          {trade.asset_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`flex items-center gap-1 text-sm font-bold ${
                        trade.side === 'BUY' ? 'text-[#10b981]' : 'text-[#ef4444]'
                      }`}>
                        {trade.side === 'BUY' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {trade.side}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-[#f3f4f6]">
                      {trade.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-[#f3f4f6]">
                      {formatCurrency(trade.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-[#f3f4f6]">
                      {formatCurrency(trade.total_value)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-semibold ${getPnLColor(trade.pnl_realized || 0)}`}>
                        {formatCurrency(trade.pnl_realized || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-xs text-[#9ca3af] truncate" title={trade.reasoning}>
                        {trade.reasoning || 'N/A'}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {filteredTrades.length === 0 && (
              <div className="text-center py-12 text-[#9ca3af]">
                No {filter.toLowerCase()} trades found
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
