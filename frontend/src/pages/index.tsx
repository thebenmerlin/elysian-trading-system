/**
 * Elysian Trading System - Main Dashboard (FIXED VERSION)
 */
import React, { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import Terminal, { useTerminalLines } from '@/components/Terminal'
import MetricCard, { PnLCard, ReturnCard, SharpeCard, DrawdownCard } from '@/components/MetricCard'
import { apiClient, formatCurrency, formatPercentage, getStatusColor } from '@/utils/api'
import { Activity, TrendingUp, DollarSign, Target, Settings, Play, Square, RotateCcw } from 'lucide-react'

export default function Dashboard() {
  const [isRunning, setIsRunning] = useState(false)
  const { lines, addLine, addSuccess, addError, addCommand } = useTerminalLines([
    { id: 'init', text: 'Elysian Trading System v1.0.0 initialized', type: 'success' },
    { id: 'loading', text: 'Loading market data and portfolio information...', type: 'info' }
  ])

  // Enhanced data fetching with error handling
  const { data: portfolio, isLoading: portfolioLoading, error: portfolioError } = useQuery(
    'portfolio',
    () => apiClient.portfolio.getCurrent(),
    {   
      refetchInterval: 30000,
      retry: 2,
      onSuccess: (data) => {
        if (data && !data.error) {
          addSuccess(`Portfolio data updated: ${formatCurrency(data.data?.total_value || 0)}`);
        } else {
          addError('Portfolio data incomplete');
        }
      },
      onError: (error: any) => {
        addError(`Failed to fetch portfolio: ${error.message || 'Unknown error'}`);
      }
    }
  )

  const { data: systemHealth } = useQuery(
    'system-health',
    () => apiClient.system.getHealth(),
    {   
      refetchInterval: 60000,
      retry: 1,
      onSuccess: (data) => {
        if (data?.data) {
          const status = data.data.status;
          if (status === 'healthy') {
            addSuccess('System health check passed');
          } else {
            addError(`System status: ${status}`);
          }
        }
      },
      onError: () => {
        addError('Health check failed - backend may be down');
      }
    }
  )

  const { data: recentTrades } = useQuery(
    'recent-trades',
    () => apiClient.trades.getRecent(10),
    { 
      refetchInterval: 30000,
      retry: 1,
      onError: () => {
        addError('Failed to fetch recent trades');
      }
    }
  )

  const { data: latestReflection } = useQuery(
    'latest-reflection',
    () => apiClient.reflections.getLatest(),
    { 
      refetchInterval: 300000,
      retry: 1
    }
  )

  // Safe data extraction with defaults
  const portfolioData = portfolio?.data || {
    total_value: 100000,
    cash: 100000,
    positions_value: 0,
    daily_pnl: 0,
    total_pnl: 0,
    metrics: {
      total_return_pct: 0,
      sharpe_ratio: 0,
      max_drawdown_pct: 0,
      win_rate: 0
    }
  };

  const healthData = systemHealth?.data || {
    status: 'unknown',
    database: 'unknown',
    components: {
      database: 'unknown',
      trading_runner: { status: 'unknown' }
    }
  };

  const tradesData = Array.isArray(recentTrades?.data) ? recentTrades.data : [];

  // Safe reflection data extraction
  const reflectionData = latestReflection?.data;
  const safeInsights = Array.isArray(reflectionData?.key_insights) ? reflectionData.key_insights : [];
  const safeRecommendations = Array.isArray(reflectionData?.recommended_adjustments) ? reflectionData.recommended_adjustments : [];

  // Enhanced action handlers with error handling
  const handleStartRunner = async () => {
    try {
      addCommand('start-runner');
      await apiClient.system.startRunner();
      addSuccess('Trading runner started successfully');
      setIsRunning(true);
      toast.success('Trading runner started');
    } catch (error: any) {
      addError(`Failed to start runner: ${error.message}`);
      toast.error('Failed to start runner');
    }
  }

  const handleStopRunner = async () => {
    try {
      addCommand('stop-runner');
      await apiClient.system.stopRunner();
      addSuccess('Trading runner stopped');
      setIsRunning(false);
      toast.success('Trading runner stopped');
    } catch (error: any) {
      addError(`Failed to stop runner: ${error.message}`);
      toast.error('Failed to stop runner');
    }
  }

  const handleRunCycle = async () => {
    try {
      addCommand('run-cycle');
      addLine('Executing trading cycle...', 'info');
      const result = await apiClient.system.runCycle();
      addSuccess('Trading cycle completed successfully');
      toast.success('Trading cycle completed');
    } catch (error: any) {
      addError(`Trading cycle failed: ${error.message}`);
      toast.error('Trading cycle failed');
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-primary p-6 font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-wider">
              ELYSIAN TRADING SYSTEM
            </h1>
            <p className="text-terminal-muted mt-1">
              Autonomous AI-Powered Hedge Fund Simulator
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded border ${
              isRunning ? 'border-terminal-primary bg-terminal-primary/10' : 'border-terminal-error bg-terminal-error/10'
            }`}>
              <span className={`text-sm font-bold ${
                isRunning ? 'text-terminal-primary' : 'text-terminal-error'
              }`}>
                {isRunning ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Portfolio Value"
            value={formatCurrency(portfolioData.total_value)}
            change={portfolioData.daily_pnl}
            changeType="currency"
            loading={portfolioLoading}
            icon={<DollarSign />}
          />
          <PnLCard pnl={portfolioData.total_pnl || 0} />
          <ReturnCard returnPct={portfolioData.metrics?.total_return_pct || 0} />
          <SharpeCard sharpe={portfolioData.metrics?.sharpe_ratio || 0} />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Terminal Display with Controls */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Activity
            </h2>
            
            {/* Trading Controls */}
            <div className="mb-4 flex gap-3">
              <button
                onClick={handleStartRunner}
                disabled={isRunning}
                className={`px-4 py-2 rounded font-bold flex items-center gap-2 transition-colors ${
                  isRunning 
                    ? 'bg-terminal-muted text-terminal-bg opacity-50 cursor-not-allowed'
                    : 'bg-terminal-primary text-terminal-bg hover:bg-terminal-secondary'
                }`}
              >
                <Play className="w-4 h-4" />
                START
              </button>
              
              <button
                onClick={handleStopRunner}
                disabled={!isRunning}
                className={`px-4 py-2 rounded font-bold flex items-center gap-2 transition-colors ${
                  !isRunning 
                    ? 'bg-terminal-muted text-terminal-bg opacity-50 cursor-not-allowed'
                    : 'bg-terminal-error text-white hover:bg-red-600'
                }`}
              >
                <Square className="w-4 h-4" />
                STOP
              </button>
              
              <button
                onClick={handleRunCycle}
                className="px-4 py-2 rounded font-bold flex items-center gap-2 transition-colors bg-terminal-secondary text-terminal-bg hover:bg-terminal-warning"
              >
                <RotateCcw className="w-4 h-4" />
                RUN CYCLE
              </button>
            </div>
            
            {/* Terminal Component (without props that don't exist) */}
            <Terminal lines={lines} />
          </div>

          {/* System Status & Recent Activity */}
          <div className="space-y-6">
            
            {/* System Status */}
            <div className="terminal-window">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                System Status
              </h3>
              
              {/* System Health */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-bold text-terminal-secondary">Health Check</p>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Database:</span>
                      <span className={getStatusColor(healthData.database)}>
                        {(healthData.database || 'UNKNOWN').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={getStatusColor(healthData.status)}>
                        {(healthData.status || 'UNKNOWN').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mode:</span>
                      <span className="text-terminal-warning">
                        PAPER TRADING
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Trades */}
            <div className="terminal-window">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Recent Trades
              </h3>
              
              {tradesData.length > 0 ? (
                <div className="space-y-2">
                  {tradesData.slice(0, 5).map((trade: any, index: number) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className={`font-bold ${
                        trade.side === 'BUY' ? 'text-terminal-primary' : 'text-terminal-error'
                      }`}>
                        {trade.side}
                      </span>
                      <span>{trade.symbol}</span>
                      <span className="text-terminal-muted">
                        {trade.quantity} @ ${(trade.executed_price || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-terminal-muted text-sm">No recent trades</p>
              )}
            </div>

            {/* AI Insights */}
            {reflectionData && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="terminal-window"
              >
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Latest AI Insights
                </h3>
                
                <div className="space-y-4 text-sm">
                  {safeInsights.length > 0 && (
                    <div>
                      <h4 className="font-bold text-terminal-secondary mb-2">Key Insights:</h4>
                      <ul className="space-y-1">
                        {safeInsights.slice(0, 3).map((insight: string, index: number) => (
                          <li key={index} className="text-terminal-muted">
                            • {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {safeRecommendations.length > 0 && (
                    <div>
                      <h4 className="font-bold text-terminal-secondary mb-2">Recommendations:</h4>
                      <ul className="space-y-1">
                        {safeRecommendations.slice(0, 2).map((rec: any, index: number) => (
                          <li key={index} className="text-terminal-muted">
                            • {rec.reasoning || rec.toString()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
