/**
 * AI Insights Page - Replacement for Reflections
 * Shows real-time AI reasoning and decision-making
 */
import React, { useState } from 'react'
import { useQuery } from 'react-query'
import Layout from '@/components/Layout'
import SignalsTable from '@/components/SignalsTable'
import { apiClient } from '@/utils/api'
import { Brain, Zap, TrendingUp } from 'lucide-react'

export default function AIInsightsPage() {
  const [activeTab, setActiveTab] = useState('signals')

  // Fetch AI signals
  const { data: signalsResponse, isLoading } = useQuery(
    'ai-insights',
    () => apiClient.signals.getRecent(50),
    { refetchInterval: 15000, retry: 1 }
  )

  const signals = signalsResponse?.data || []

  // Calculate stats
  const buySignals = signals.filter((s: any) => s.signal_type === 'BUY').length
  const sellSignals = signals.filter((s: any) => s.signal_type === 'SELL').length
  const executedSignals = signals.filter((s: any) => s.executed).length
  const avgConfidence = signals.length > 0
    ? signals.reduce((sum: number, s: any) => sum + s.confidence, 0) / signals.length
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
        {/* AI Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5 text-[#3b82f6]" />
              <div className="text-sm text-[#9ca3af]">Total Signals</div>
            </div>
            <div className="text-3xl font-bold text-[#f3f4f6]">{signals.length}</div>
          </div>

          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-[#10b981]" />
              <div className="text-sm text-[#9ca3af]">Buy / Sell</div>
            </div>
            <div className="text-3xl font-bold text-[#f3f4f6]">
              {buySignals} / {sellSignals}
            </div>
          </div>

          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-[#f59e0b]" />
              <div className="text-sm text-[#9ca3af]">Executed</div>
            </div>
            <div className="text-3xl font-bold text-[#f3f4f6]">{executedSignals}</div>
            <div className="text-xs text-[#9ca3af] mt-1">
              {signals.length > 0 ? ((executedSignals / signals.length) * 100).toFixed(1) : 0}% execution rate
            </div>
          </div>

          <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm text-[#9ca3af]">Avg Confidence</div>
            </div>
            <div className="text-3xl font-bold text-[#3b82f6]">
              {(avgConfidence * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* AI Signals Table */}
        <SignalsTable signals={signals} />

        {/* AI Methodology */}
        <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
          <h3 className="text-lg font-semibold text-[#f3f4f6] mb-4">AI Decision Engine Methodology</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-[#3b82f6] mb-2">Technical Analysis</h4>
              <ul className="space-y-1 text-[#9ca3af]">
                <li>• RSI (Relative Strength Index)</li>
                <li>• MACD (Moving Average Convergence)</li>
                <li>• Bollinger Bands Position</li>
                <li>• Volume Analysis</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#3b82f6] mb-2">Momentum Indicators</h4>
              <ul className="space-y-1 text-[#9ca3af]">
                <li>• Price Change (1h & 24h)</li>
                <li>• Volatility Metrics</li>
                <li>• Trend Strength</li>
                <li>• Market Momentum</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-[#3b82f6] mb-2">Risk Management</h4>
              <ul className="space-y-1 text-[#9ca3af]">
                <li>• Confidence Threshold (&gt;0.5)</li>
                <li>• Position Size Limits</li>
                <li>• Portfolio Exposure Control</li>
                <li>• Stop-Loss Calculation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
