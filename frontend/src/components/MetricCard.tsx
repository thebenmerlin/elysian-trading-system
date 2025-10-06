/**
 * Elysian Trading System - Metric Card Component
 * Displays key metrics with terminal styling
 */

import React from 'react'
import { motion } from 'framer-motion'
import { formatCurrency, formatPercentage, getPnLColor } from '@/utils/api'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  changeType?: 'currency' | 'percentage' | 'number'
  subtitle?: string
  icon?: React.ReactNode
  status?: 'positive' | 'negative' | 'neutral'
  className?: string
  loading?: boolean
}

export default function MetricCard({
  title,
  value,
  change,
  changeType = 'percentage',
  subtitle,
  icon,
  status,
  className = '',
  loading = false
}: MetricCardProps) {

  const formatChangeValue = (changeValue: number): string => {
    switch (changeType) {
      case 'currency':
        return formatCurrency(changeValue)
      case 'percentage':
        return formatPercentage(changeValue)
      case 'number':
        return changeValue.toLocaleString()
      default:
        return changeValue.toString()
    }
  }

  const getCardStatus = (): string => {
    if (status) return status
    if (change !== undefined) {
      if (change > 0) return 'positive'
      if (change < 0) return 'negative'
    }
    return 'neutral'
  }

  const cardStatus = getCardStatus()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`metric-card ${cardStatus} ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {icon && (
            <div className="text-terminal-primary">
              {icon}
            </div>
          )}
          <h3 className="text-terminal-muted text-sm font-mono uppercase tracking-wider">
            {title}
          </h3>
        </div>

        {loading && (
          <div className="spinner"></div>
        )}
      </div>

      {/* Main value */}
      <div className="mb-2">
        {loading ? (
          <div className="h-8 bg-terminal-border animate-pulse rounded"></div>
        ) : (
          <div className="text-2xl font-mono font-bold text-terminal-primary">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
        )}
      </div>

      {/* Change and subtitle */}
      <div className="flex items-center justify-between text-sm">
        {change !== undefined && !loading && (
          <div className={`flex items-center space-x-1 font-mono ${getPnLColor(change)}`}>
            <span>{change >= 0 ? '↗' : '↘'}</span>
            <span>{formatChangeValue(change)}</span>
          </div>
        )}

        {subtitle && (
          <div className="text-terminal-muted text-xs">
            {subtitle}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Specialized metric cards
export function PnLCard({ pnl, className = '' }: { pnl: number; className?: string }) {
  return (
    <MetricCard
      title="P&L"
      value={formatCurrency(pnl)}
      change={pnl}
      changeType="currency"
      status={pnl >= 0 ? 'positive' : 'negative'}
      className={className}
      icon={<span className="text-lg">{pnl >= 0 ? '📈' : '📉'}</span>}
    />
  )
}

export function ReturnCard({ returnPct, className = '' }: { returnPct: number; className?: string }) {
  return (
    <MetricCard
      title="Total Return"
      value={formatPercentage(returnPct)}
      change={returnPct}
      changeType="percentage"
      status={returnPct >= 0 ? 'positive' : 'negative'}
      className={className}
      icon={<span className="text-lg">💰</span>}
    />
  )
}

export function SharpeCard({ sharpe, className = '' }: { sharpe: number; className?: string }) {
  const getStatus = (value: number): 'positive' | 'negative' | 'neutral' => {
    if (value > 1.5) return 'positive'
    if (value < 0.8) return 'negative'
    return 'neutral'
  }

  return (
    <MetricCard
      title="Sharpe Ratio"
      value={sharpe.toFixed(2)}
      subtitle="Risk-adj. return"
      status={getStatus(sharpe)}
      className={className}
      icon={<span className="text-lg">⚖️</span>}
    />
  )
}

export function DrawdownCard({ drawdown, className = '' }: { drawdown: number; className?: string }) {
  const getStatus = (value: number): 'positive' | 'negative' | 'neutral' => {
    if (value < 5) return 'positive'
    if (value > 15) return 'negative'
    return 'neutral'
  }

  return (
    <MetricCard
      title="Max Drawdown"
      value={`${drawdown.toFixed(1)}%`}
      status={getStatus(drawdown)}
      className={className}
      icon={<span className="text-lg">📉</span>}
    />
  )
}
