/**
 * KPI Grid - Key Performance Indicators
 */
import React from 'react'
import { DollarSign, TrendingUp, Briefcase, Zap } from 'lucide-react'
import { motion } from 'framer-motion'

interface KPICardProps {
  title: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ReactNode
}

const KPICard: React.FC<KPICardProps> = ({ title, value, change, changeType, icon }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6 hover:border-[#3b82f6]/50 transition-all"
  >
    <div className="flex items-start justify-between mb-4">
      <div className="text-[#9ca3af] text-sm font-medium">{title}</div>
      <div className="text-[#3b82f6]">{icon}</div>
    </div>
    <div className="text-3xl font-bold text-[#f3f4f6] mb-2">{value}</div>
    {change && (
      <div className={`text-sm font-medium ${
        changeType === 'positive' ? 'text-[#10b981]' : 
        changeType === 'negative' ? 'text-[#ef4444]' : 'text-[#9ca3af]'
      }`}>
        {change}
      </div>
    )}
  </motion.div>
)

interface KPIGridProps {
  portfolioValue: number
  dailyPnL: number
  activePositions: number
  signalsToday: number
}

export default function KPIGrid({ portfolioValue, dailyPnL, activePositions, signalsToday }: KPIGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <KPICard
        title="Portfolio Value"
        value={`$${portfolioValue.toLocaleString()}`}
        change={dailyPnL >= 0 ? `+$${Math.abs(dailyPnL).toLocaleString()}` : `-$${Math.abs(dailyPnL).toLocaleString()}`}
        changeType={dailyPnL >= 0 ? 'positive' : 'negative'}
        icon={<DollarSign className="w-5 h-5" />}
      />
      <KPICard
        title="Daily P&L"
        value={dailyPnL >= 0 ? `+$${dailyPnL.toLocaleString()}` : `-$${Math.abs(dailyPnL).toLocaleString()}`}
        change={`${((dailyPnL / portfolioValue) * 100).toFixed(2)}%`}
        changeType={dailyPnL >= 0 ? 'positive' : 'negative'}
        icon={<TrendingUp className="w-5 h-5" />}
      />
      <KPICard
        title="Active Positions"
        value={activePositions.toString()}
        change={`${((activePositions / 10) * 100).toFixed(0)}% capacity`}
        changeType="neutral"
        icon={<Briefcase className="w-5 h-5" />}
      />
      <KPICard
        title="AI Signals Today"
        value={signalsToday.toString()}
        change="Last 24 hours"
        changeType="neutral"
        icon={<Zap className="w-5 h-5" />}
      />
    </div>
  )
}
