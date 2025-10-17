/**
 * Portfolio Page - Standalone Version
 * Can be accessed at /portfolio
 */
import React from 'react'
import { useQuery } from 'react-query'
import Layout from '@/components/Layout'
import PortfolioTable from '@/components/PortfolioTable'
import KPIGrid from '@/components/KPIGrid'
import { apiClient } from '@/utils/api'

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = React.useState('portfolio')

  // Fetch portfolio data
  const { data: portfolioResponse, isLoading } = useQuery(
    'portfolio-standalone',
    () => apiClient.portfolio.getCurrent(),
    { refetchInterval: 10000, retry: 1 }
  )

  // Fetch signals for KPI calculation
  const { data: signalsResponse } = useQuery(
    'signals-for-kpi',
    () => apiClient.signals.getRecent(100),
    { refetchInterval: 30000, retry: 1 }
  )

  const portfolio = portfolioResponse?.data || {
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
  }

  const signals = signalsResponse?.data || []

  // Calculate signals today
  const signalsToday = signals.filter((s: any) => {
    const signalDate = new Date(s.timestamp)
    const today = new Date()
    return signalDate.toDateString() === today.toDateString()
  }).length

  if (isLoading) {
    return (
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="flex items-center justify-center h-full">
          <div className="text-[#9ca3af] text-lg">Loading portfolio...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="space-y-6">
        {/* KPI Overview */}
        <KPIGrid
          portfolioValue={portfolio.total_value}
          dailyPnL={portfolio.daily_pnl}
          activePositions={portfolio.positions_count}
          signalsToday={signalsToday}
        />

        {/* Portfolio Positions Table */}
        <PortfolioTable
          positions={portfolio.positions}
          cashBalance={portfolio.cash_balance}
          totalValue={portfolio.total_value}
        />

        {/* Portfolio Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
            <div className="text-sm text-[#9ca3af] mb-2">Total Return</div>
            <div className={`text-2xl font-bold ${
              (portfolio.metrics?.total_return_pct || 0) >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
            }`}>
              {(portfolio.metrics?.total_return_pct || 0) >= 0 ? '+' : ''}
              {(portfolio.metrics?.total_return_pct || 0).toFixed(2)}%
            </div>
          </div>

          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
            <div className="text-sm text-[#9ca3af] mb-2">Sharpe Ratio</div>
            <div className="text-2xl font-bold text-[#3b82f6]">
              {(portfolio.metrics?.sharpe_ratio || 0).toFixed(2)}
            </div>
          </div>

          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
            <div className="text-sm text-[#9ca3af] mb-2">Max Drawdown</div>
            <div className="text-2xl font-bold text-[#ef4444]">
              {(portfolio.metrics?.max_drawdown_pct || 0).toFixed(2)}%
            </div>
          </div>

          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
            <div className="text-sm text-[#9ca3af] mb-2">Win Rate</div>
            <div className="text-2xl font-bold text-[#10b981]">
              {(portfolio.metrics?.win_rate || 0).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
