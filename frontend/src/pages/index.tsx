/**
 * Elysian Trading System - Main Dashboard
 * Terminal-style real-time trading dashboard
 */

import React, { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import Terminal, { useTerminalLines } from '@/components/Terminal'
import MetricCard, { PnLCard, ReturnCard, SharpeCard, DrawdownCard } from '@/components/MetricCard'
import { apiClient, formatCurrency, formatPercentage, getStatusColor } from '@/utils/api'
import { Activity, TrendingUp, DollarSign, Target, Settings, Play, Square } from 'lucide-react'

export default function Dashboard() {
  const [isRunning, setIsRunning] = useState(false)
  const { lines, addLine, addSuccess, addError, addCommand } = useTerminalLines([
    { id: 'init', text: 'Elysian Trading System v1.0.0 initialized', type: 'success' },
    { id: 'loading', text: 'Loading market data and portfolio information...', type: 'info' }
  ])

  // Data fetching
  const { data: portfolio, isLoading: portfolioLoading, error: portfolioError } = useQuery(
    'portfolio',
    () => apiClient.portfolio.getCurrent(),
    { 
      refetchInterval: 30000, // Refresh every 30 seconds
      onSuccess: () => {
        addSuccess('Portfolio data updated')
      },
      onError: () => {
        addError('Failed to fetch portfolio data')
      }
    }
  )

  const { data: systemHealth } = useQuery(
    'system-health',
    () => apiClient.system.getHealth(),
    { 
      refetchInterval: 60000, // Check health every minute
      onSuccess: (data) => {
        setIsRunning(data.data.components.trading_runner.status === 'running')
      }
    }
  )

  const { data: recentTrades } = useQuery(
    'recent-trades',
    () => apiClient.trades.getRecent(10),
    { refetchInterval: 15000 }
  )

  const { data: latestReflection } = useQuery(
    'latest-reflection',
    () => apiClient.reflections.getLatest(),
    { refetchInterval: 300000 } // Every 5 minutes
  )

  useEffect(() => {
    if (portfolio?.data) {
      addLine(`Portfolio value: ${formatCurrency(portfolio.data.total_value)}`, 'info')
    }
  }, [portfolio])

  useEffect(() => {
    if (portfolioError) {
      addError('Connection to trading system lost')
    }
  }, [portfolioError])

  const handleStartRunner = async () => {
    try {
      addCommand('start-runner')
      await apiClient.system.startRunner()
      addSuccess('Trading runner started successfully')
      setIsRunning(true)
      toast.success('Trading runner started')
    } catch (error) {
      addError('Failed to start trading runner')
      toast.error('Failed to start runner')
    }
  }

  const handleStopRunner = async () => {
    try {
      addCommand('stop-runner')
      await apiClient.system.stopRunner()
      addSuccess('Trading runner stopped')
      setIsRunning(false)
      toast.success('Trading runner stopped')
    } catch (error) {
      addError('Failed to stop trading runner')
      toast.error('Failed to stop runner')
    }
  }

  const handleRunCycle = async () => {
    try {
      addCommand('run-cycle')
      addLine('Executing trading cycle...', 'info')
      const result = await apiClient.system.runCycle()
      addSuccess(`Trading cycle completed: ${result.data.data.signals_generated} signals, ${result.data.data.trades_executed} trades`)
      toast.success('Trading cycle completed')
    } catch (error) {
      addError('Trading cycle failed')
      toast.error('Trading cycle failed')
    }
  }

  const portfolioData = portfolio?.data
  const healthData = systemHealth?.data
  const tradesData = recentTrades?.data

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
            <h1 className="text-4xl font-mono font-bold text-terminal-primary mb-2">
              ELYSIAN TRADING SYSTEM
            </h1>
            <p className="text-terminal-muted font-mono">
              Autonomous AI-Powered Hedge Fund Simulator
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className={`status-indicator ${isRunning ? 'running' : 'stopped'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isRunning ? 'bg-terminal-primary animate-pulse' : 'bg-terminal-muted'}`}></div>
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </div>

            <button
              onClick={isRunning ? handleStopRunner : handleStartRunner}
              className={`btn-terminal ${isRunning ? 'danger' : ''} flex items-center space-x-2`}
            >
              {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? 'STOP' : 'START'}</span>
            </button>

            <button
              onClick={handleRunCycle}
              disabled={!isRunning}
              className="btn-terminal flex items-center space-x-2"
            >
              <Activity className="w-4 h-4" />
              <span>RUN CYCLE</span>
            </button>
          </div>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Portfolio Value"
            value={portfolioData ? formatCurrency(portfolioData.total_value) : '--'}
            change={portfolioData?.daily_pnl}
            changeType="currency"
            loading={portfolioLoading}
            icon={<DollarSign className="w-5 h-5" />}
          />

          <PnLCard 
            pnl={portfolioData?.total_pnl || 0}
          />

          <ReturnCard 
            returnPct={portfolioData?.metrics?.total_return_pct || 0}
          />

          <SharpeCard 
            sharpe={portfolioData?.metrics?.sharpe_ratio || 0}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Terminal Display */}
          <div className="space-y-4">
            <h2 className="text-xl font-mono font-bold text-terminal-primary flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              System Activity
            </h2>
            <Terminal lines={lines} maxLines={15} />
          </div>

          {/* System Status & Recent Activity */}
          <div className="space-y-4">
            <h2 className="text-xl font-mono font-bold text-terminal-primary flex items-center">
              <Target className="w-5 h-5 mr-2" />
              System Status
            </h2>

            {/* System Health */}
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <div className="ml-4 text-terminal-muted text-sm font-mono">Health Check</div>
              </div>
              <div className="terminal-content">
                {healthData ? (
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex justify-between">
                      <span>Database:</span>
                      <span className={getStatusColor(healthData.components.database)}>
                        {healthData.components.database.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Runner:</span>
                      <span className={getStatusColor(healthData.components.trading_runner.status)}>
                        {healthData.components.trading_runner.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Run Count:</span>
                      <span>{healthData.components.trading_runner.run_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Live Trading:</span>
                      <span className={healthData.configuration.live_trading ? 'text-terminal-warning' : 'text-terminal-muted'}>
                        {healthData.configuration.live_trading ? 'ENABLED' : 'PAPER MODE'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-terminal-muted">Loading system status...</div>
                )}
              </div>
            </div>

            {/* Recent Trades */}
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <div className="ml-4 text-terminal-muted text-sm font-mono">Recent Trades</div>
              </div>
              <div className="terminal-content">
                {tradesData?.data && tradesData.data.length > 0 ? (
                  <div className="space-y-2">
                    {tradesData.data.slice(0, 5).map((trade: any) => (
                      <div key={trade.id} className="flex justify-between items-center text-sm font-mono">
                        <div className="flex items-center space-x-2">
                          <span className={trade.side === 'BUY' ? 'text-terminal-primary' : 'text-terminal-error'}>
                            {trade.side}
                          </span>
                          <span>{trade.symbol}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span>{trade.quantity}</span>
                          <span>@</span>
                          <span>${trade.executed_price.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-terminal-muted text-sm">No recent trades</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        {latestReflection?.data && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="terminal-window"
          >
            <div className="terminal-header">
              <div className="terminal-dot red"></div>
              <div className="terminal-dot yellow"></div>
              <div className="terminal-dot green"></div>
              <div className="ml-4 text-terminal-muted text-sm font-mono">
                Latest AI Insights
              </div>
            </div>
            <div className="terminal-content">
              <div className="space-y-4">
                <div>
                  <h4 className="text-terminal-primary font-mono font-bold mb-2">Key Insights:</h4>
                  <div className="space-y-1">
                    {latestReflection.data.key_insights.slice(0, 3).map((insight: string, index: number) => (
                      <div key={index} className="text-terminal-muted text-sm font-mono">
                        • {insight}
                      </div>
                    ))}
                  </div>
                </div>

                {latestReflection.data.recommended_adjustments.length > 0 && (
                  <div>
                    <h4 className="text-terminal-warning font-mono font-bold mb-2">Recommendations:</h4>
                    <div className="space-y-1">
                      {latestReflection.data.recommended_adjustments.slice(0, 2).map((rec: any, index: number) => (
                        <div key={index} className="text-terminal-muted text-sm font-mono">
                          • {rec.reasoning}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
