/**
 * Elysian Trading System - Dual-Market Dashboard (CORRECTED)
 */
import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import Terminal, { useTerminalLines } from '@/components/Terminal'
import MetricCard, { PnLCard, ReturnCard, SharpeCard } from '@/components/MetricCard'
import { apiClient, formatCurrency, formatPercentage, getStatusColor, getPnLColor } from '@/utils/api'
import { Activity, TrendingUp, DollarSign, Target, Settings, Play, Square, RotateCcw, Globe } from 'lucide-react'

export default function Dashboard() {
  const [isRunning, setIsRunning] = useState(false)
  const [showCrypto, setShowCrypto] = useState(true)
  const [activeMarket, setActiveMarket] = useState<'both' | 'equity' | 'crypto'>('both')
  
  const { lines, addLine, addSuccess, addError, addCommand } = useTerminalLines([
    { id: 'init', text: 'Elysian Dual-Market Trading System v2.0.0 initialized', type: 'success' },
    { id: 'loading', text: 'Loading equity and crypto market data...', type: 'info' }
  ])

  const { data: portfolio, isLoading: portfolioLoading } = useQuery(
    'portfolio',
    () => apiClient.portfolio.getCurrent(),
    {   
      refetchInterval: 30000,
      retry: 2,
      onSuccess: (data) => {
        if (data && !data.error) {
          addSuccess(`Portfolio updated: ${formatCurrency(data.data?.total_value || 0)}`);
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
            addSuccess('Dual-market system healthy');
          } else {
            addError(`System status: ${status}`);
          }
        }
      },
      onError: () => {
        addError('Health check failed');
      }
    }
  )

  const { data: runnerStatus } = useQuery(
    'runner-status',
    () => apiClient.system.getRunnerStatus(),
    {
      refetchInterval: 30000,
      retry: 1,
      onSuccess: (data) => {
        if (data?.data) {
          setIsRunning(data.data.is_running || false);
          const equityCount = (data.data as any).equity_run_count || 0;
          const cryptoCount = (data.data as any).crypto_run_count || 0;
          if (equityCount > 0 || cryptoCount > 0) {
            addLine(`Cycles - Equity: ${equityCount}, Crypto: ${cryptoCount}`, 'info');
          }
        }
      }
    }
  )

  const { data: marketStatus } = useQuery(
    'market-status',
    async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://elysian-backend-bd3o.onrender.com'}/api/market/status`, {
          headers: { 'x-elysian-key': process.env.NEXT_PUBLIC_API_KEY || 'elysian-demo-key' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        return {
          data: {
            equity: { is_open: false, trading_hours: '9:30 AM - 4:00 PM EST' },
            crypto: { is_open: true, trading_hours: '24/7' }
          }
        };
      }
    },
    { refetchInterval: 60000, retry: 1 }
  )

  const { data: recentTrades } = useQuery(
    'recent-trades',
    () => apiClient.trades.getRecent(10),
    { 
      refetchInterval: 30000,
      retry: 1,
      onError: () => {
        addError('Failed to fetch trades');
      }
    }
  )

  const { data: cryptoData } = useQuery(
    'crypto-market-data',
    async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://elysian-backend-bd3o.onrender.com'}/api/crypto/latest`, {
          headers: { 'x-elysian-key': process.env.NEXT_PUBLIC_API_KEY || 'elysian-demo-key' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        return { data: [] };
      }
    },
    { 
      refetchInterval: 10000,
      retry: 1,
      onSuccess: (data) => {
        if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
          addLine(`Crypto updated: ${data.data.length} pairs`, 'success');
        }
      }
    }
  )

  const { data: latestReflection } = useQuery(
    'latest-reflection',
    () => apiClient.reflections.getLatest(),
    { refetchInterval: 300000, retry: 1 }
  )

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
    database: 'unknown'
  };

  const runnerData = runnerStatus?.data || {
    is_running: false,
    equity_config: { tickers: [], run_interval_minutes: 15 },
    crypto_config: { tickers: [], run_interval_minutes: 5 },
    equity_run_count: 0,
    crypto_run_count: 0,
    system_health: 1.0
  };

  const marketData = marketStatus?.data || {
    equity: { is_open: false, trading_hours: '9:30 AM - 4:00 PM EST' },
    crypto: { is_open: true, trading_hours: '24/7' }
  };

  const tradesData = Array.isArray(recentTrades?.data) ? recentTrades.data : [];
  const cryptoMarketData = Array.isArray(cryptoData?.data) ? cryptoData.data : [];

  const reflectionData = latestReflection?.data;
  const safeInsights = Array.isArray(reflectionData?.key_insights) ? reflectionData.key_insights : [];
  const safeRecommendations = Array.isArray(reflectionData?.recommended_adjustments) ? reflectionData.recommended_adjustments : [];

  const handleStartRunner = async () => {
    try {
      addCommand('start-dual-market-runner');
      await apiClient.system.startRunner();
      addSuccess('Dual-market runner started');
      setIsRunning(true);
      toast.success('Runner started');
    } catch (error: any) {
      addError(`Failed to start: ${error.message}`);
      toast.error('Failed to start');
    }
  }

  const handleStopRunner = async () => {
    try {
      addCommand('stop-dual-market-runner');
      await apiClient.system.stopRunner();
      addSuccess('Dual-market runner stopped');
      setIsRunning(false);
      toast.success('Runner stopped');
    } catch (error: any) {
      addError(`Failed to stop: ${error.message}`);
      toast.error('Failed to stop');
    }
  }

  const handleRunCycle = async () => {
    try {
      addCommand('run-trading-cycle');
      addLine('Executing trading cycle...', 'info');
      await apiClient.system.runCycle();
      addSuccess('Cycle completed');
      toast.success('Cycle completed');
    } catch (error: any) {
      addError(`Cycle failed: ${error.message}`);
      toast.error('Cycle failed');
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-primary p-6 font-mono">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-wider">PROJECT ELYSIAN</h1>
            <p className="text-terminal-muted mt-1">DUAL-MARKET AUTONOMOUS TRADING • BY GAJANAN BARVE</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <div className={`px-2 py-1 rounded text-xs border ${
                marketData.equity?.is_open 
                  ? 'border-terminal-primary bg-terminal-primary/10 text-terminal-primary' 
                  : 'border-terminal-muted bg-terminal-muted/10 text-terminal-muted'
              }`}>
                📈 EQUITY {marketData.equity?.is_open ? 'OPEN' : 'CLOSED'}
              </div>
              <div className="px-2 py-1 rounded text-xs border border-yellow-400 bg-yellow-400/10 text-yellow-400">
                🪙 CRYPTO 24/7
              </div>
            </div>
            
            <div className={`px-3 py-1 rounded border ${
              isRunning ? 'border-terminal-primary bg-terminal-primary/10' : 'border-terminal-error bg-terminal-error/10'
            }`}>
              <span className={`text-sm font-bold ${isRunning ? 'text-terminal-primary' : 'text-terminal-error'}`}>
                {isRunning ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Portfolio Value"
            value={formatCurrency(portfolioData.total_value)}
            change={portfolioData.daily_pnl}
            changeType="currency"
            loading={portfolioLoading}
            icon={<DollarSign />}
            subtitle="Equity + Crypto"
          />
          <PnLCard pnl={portfolioData.total_pnl || 0} />
          <ReturnCard returnPct={portfolioData.metrics?.total_return_pct || 0} />
          <div className="metric-card neutral">
            <div className="flex items-center justify-between mb-2">
              <Globe className="w-4 h-4" />
              <div className="text-xs text-terminal-muted">
                Health: {((runnerData.system_health || 1.0) * 100).toFixed(0)}%
              </div>
            </div>
            <h3 className="text-sm font-bold text-terminal-secondary mb-2">System Health</h3>
            <div className="text-2xl font-mono">
              {(runnerData.system_health || 1.0) >= 0.8 ? '🟢' : (runnerData.system_health || 1.0) >= 0.5 ? '🟡' : '🔴'}
            </div>
            <div className="text-xs text-terminal-muted mt-1">
              {(runnerData.system_health || 1.0) >= 0.8 ? 'Excellent' : (runnerData.system_health || 1.0) >= 0.5 ? 'Good' : 'Degraded'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Activity
              <span className="text-sm text-terminal-muted ml-2">
                (Equity: {(runnerData as any).equity_run_count || 0} | Crypto: {(runnerData as any).crypto_run_count || 0} cycles)
              </span>
            </h2>
            
            <div className="mb-4 flex gap-3 flex-wrap">
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
                START DUAL-MARKET
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
                STOP ALL
              </button>
              
              <button
                onClick={handleRunCycle}
                className="px-4 py-2 rounded font-bold flex items-center gap-2 transition-colors bg-terminal-secondary text-terminal-bg hover:bg-terminal-warning"
              >
                <RotateCcw className="w-4 h-4" />
                RUN CYCLE
              </button>

              <div className="flex rounded border border-terminal-border overflow-hidden">
                {(['both', 'equity', 'crypto'] as const).map((market) => (
                  <button
                    key={market}
                    onClick={() => setActiveMarket(market)}
                    className={`px-3 py-2 text-xs font-bold transition-colors ${
                      activeMarket === market
                        ? 'bg-terminal-primary text-terminal-bg'
                        : 'bg-terminal-bg text-terminal-muted hover:text-terminal-primary'
                    }`}
                  >
                    {market.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            
            <Terminal lines={lines} />
          </div>

          <div className="space-y-6">
            
            <div className="terminal-window">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                System Status
              </h3>
              
              <div className="space-y-4">
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
                      <span>System:</span>
                      <span className={getStatusColor(healthData.status)}>
                        {(healthData.status || 'UNKNOWN').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mode:</span>
                      <span className="text-terminal-warning">PAPER TRADING</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-terminal-secondary">Market Hours</p>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Equity:</span>
                      <span className={marketData.equity?.is_open ? 'text-terminal-primary' : 'text-terminal-muted'}>
                        {marketData.equity?.trading_hours || '9:30 AM - 4:00 PM EST'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Crypto:</span>
                      <span className="text-yellow-400">
                        {marketData.crypto?.trading_hours || '24/7'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-bold text-terminal-secondary">Configuration</p>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Equity Interval:</span>
                      <span className="text-terminal-muted">
                        {(runnerData as any).equity_config?.run_interval_minutes || 15}min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Crypto Interval:</span>
                      <span className="text-yellow-400">
                        {(runnerData as any).crypto_config?.run_interval_minutes || 5}min
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {showCrypto && (
              <div className="terminal-window">
                <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-400">₿</span>
                    Crypto Markets
                  </div>
                  <button
                    onClick={() => setShowCrypto(!showCrypto)}
                    className="text-xs px-2 py-1 border border-terminal-border rounded hover:bg-terminal-border/20"
                  >
                    Hide
                  </button>
                </h3>
                
                {cryptoMarketData.length > 0 ? (
                  <div className="space-y-2">
                    {cryptoMarketData.slice(0, 5).map((crypto: any, index: number) => (
                      <div key={index} className="flex justify-between items-center text-sm border-b border-terminal-border/20 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-terminal-secondary">
                            {crypto.symbol?.replace('USDT', '/USDT') || 'N/A'}
                          </span>
                          <span className="text-xs px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                            CRYPTO
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-mono">
                            ${parseFloat(crypto.close || 0).toLocaleString(undefined, {
                              minimumFractionDigits: (crypto.close || 0) > 1 ? 2 : 6,
                              maximumFractionDigits: (crypto.close || 0) > 1 ? 2 : 6
                            })}
                          </div>
                          <div className={`text-xs ${getPnLColor(crypto.change_24h || 0)}`}>
                            {crypto.change_24h ? `${crypto.change_24h > 0 ? '+' : ''}${crypto.change_24h.toFixed(2)}%` : '0.00%'}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="text-xs text-terminal-muted mt-3 pt-2 border-t border-terminal-border/20">
                      <div className="flex justify-between">
                        <span>Data Source:</span>
                        <span className="text-terminal-secondary">Binance API</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Update:</span>
                        <span className="text-terminal-secondary">10 seconds</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <span className="text-terminal-primary">24/7 ACTIVE</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-terminal-muted text-sm">Loading crypto data...</p>
                    <div className="mt-2 text-xs text-terminal-muted">
                      Connecting to Binance API...
                    </div>
                  </div>
                )}
              </div>
            )}

            {!showCrypto && (
              <div className="terminal-window">
                <button
                  onClick={() => setShowCrypto(true)}
                  className="w-full py-3 text-sm font-bold text-yellow-400 border border-yellow-400/20 rounded hover:bg-yellow-400/10 transition-colors"
                >
                  <span className="mr-2">₿</span>
                  Show Crypto Markets
                </button>
              </div>
            )}

            <div className="terminal-window">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Recent Trades
              </h3>
              
              {tradesData.length > 0 ? (
                <div className="space-y-2">
                  {tradesData.slice(0, 5).map((trade: any, index: number) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${
                          trade.side === 'BUY' ? 'text-terminal-primary' : 'text-terminal-error'
                        }`}>
                          {trade.side}
                        </span>
                        <span className={`text-xs px-1 py-0.5 rounded ${
                          trade.market_type === 'crypto' 
                            ? 'bg-yellow-500/20 text-yellow-400' 
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {(trade.market_type || 'equity').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right">
                        <div>{trade.symbol}</div>
                        <div className="text-terminal-muted text-xs">
                          {trade.quantity} @ ${(trade.executed_price || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-terminal-muted text-sm">No recent trades</p>
                  <div className="mt-2 text-xs text-terminal-muted">
                    Start the runner to begin trading
                  </div>
                </div>
              )}
            </div>

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
                          <li key={index} className="text-terminal-muted">• {insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {safeRecommendations.length > 0 && (
                    <div>
                      <h4 className="font-bold text-terminal-secondary mb-2">Recommendations:</h4>
                      <ul className="space-y-1">
                        {safeRecommendations.slice(0, 2).map((rec: any, index: number) => (
                          <li key={index} className="text-terminal-muted">• {rec.reasoning || rec.toString()}</li>
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
