'use client'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import React, { useState } from 'react'
import { useQuery } from 'react-query'
import Layout from '@/components/Layout'
import SignalsTable from '@/components/SignalsTable'
import { apiClient } from '@/utils/api'
import { Brain, Zap, TrendingUp } from 'lucide-react'

export default function AIInsightsPage() {
  const [activeTab, setActiveTab] = useState('signals')
  const { data: signalsResponse, isLoading } = useQuery(
    'ai-insights',
    () => apiClient.signals.getRecent(50),
    { refetchInterval: 15000, retry: 1 }
  )
  const signals = signalsResponse?.data || []

  const buySignals = signals.filter(s => s.signal_type === 'BUY').length
  const sellSignals = signals.filter(s => s.signal_type === 'SELL').length
  const executedSignals = signals.filter(s => s.executed).length
  const avgConfidence = signals.length
    ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
    : 0

  if (isLoading) {
    return (
      <Layout activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="flex items-center justify-center h-full">
          <div className="text-[#9ca3af] text-lg">Loading AI insights...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* AI stats cards */}
        </div>
        <SignalsTable signals={signals} />
        <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
          {/* Methodology section */}
        </div>
      </div>
    </Layout>
  )
}
