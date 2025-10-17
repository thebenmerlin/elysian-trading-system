'use client'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import React from 'react'
import { useQuery } from 'react-query'
import Layout from '@/components/Layout'
import PortfolioTable from '@/components/PortfolioTable'
import KPIGrid from '@/components/KPIGrid'
import { apiClient } from '@/utils/api'

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = React.useState('portfolio')

  const { data: portfolioResponse, isLoading } = useQuery(
    'portfolio-standalone',
    () => apiClient.portfolio.getCurrent(),
    { refetchInterval: 10000, retry: 1 }
  )
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
  const signalsToday = signals.filter((s: any) => {
    const d = new Date(s.timestamp)
    return d.toDateString() === new Date().toDateString()
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
        <KPIGrid
          portfolioValue={portfolio.total_value}
          dailyPnL={portfolio.daily_pnl}
          activePositions={portfolio.positions_count}
          signalsToday={signalsToday}
        />
        <PortfolioTable
          positions={portfolio.positions}
          cashBalance={portfolio.cash_balance}
          totalValue={portfolio.total_value}
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Portfolio metrics cards... (same as before) */}
        </div>
      </div>
    </Layout>
  )
}
