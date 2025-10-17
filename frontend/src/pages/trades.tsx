'use client'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import Layout from '@/components/Layout'
import { apiClient, formatCurrency, formatDate, getPnLColor } from '@/utils/api'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function TradesPage() {
  const [activeTab, setActiveTab] = useState('trades')
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'CRYPTO' | 'EQUITY'>('ALL')

  const { data: tradesResponse, isLoading } = useQuery(
    'trades-page',
    () => apiClient.trades.getRecent(50),
    { refetchInterval: 10000, retry: 1 }
  )
  const allTrades = tradesResponse?.data || []

  const filteredTrades = allTrades.filter(t => {
    if (filter === 'ALL') return true
    if (filter === 'BUY') return t.side === 'BUY'
    if (filter === 'SELL') return t.side === 'SELL'
    if (filter === 'CRYPTO') return t.asset_type === 'crypto'
    if (filter === 'EQUITY') return t.asset_type === 'equity'
    return true
  })

  const totalPnL = allTrades.reduce((sum, t) => sum + (t.pnl_realized || 0), 0)
  const buyCount = allTrades.filter(t => t.side === 'BUY').length
  const sellCount = allTrades.filter(t => t.side === 'SELL').length
  const cryptoCount = allTrades.filter(t => t.asset_type === 'crypto').length
  const equityCount = allTrades.filter(t => t.asset_type === 'equity').length

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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Stats cards... */}
        </div>
        <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] overflow-hidden">
          {/* Filters and table... */}
        </div>
      </div>
    </Layout>
  )
}
