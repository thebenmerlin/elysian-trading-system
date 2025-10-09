/**
 * Elysian Trading System - Portfolio Page (SAFE VERSION)
 */
import React from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import MetricCard, { PnLCard, ReturnCard, SharpeCard, DrawdownCard } from '@/components/MetricCard'
import { apiClient, formatCurrency, formatPercentage, formatDate, getPnLColor } from '@/utils/api'
import { DollarSign, TrendingUp, Target, PieChart as PieChartIcon } from 'lucide-react'

export default function Portfolio() {
  // Data fetching with safe defaults
  const { data: portfolio, isLoading: portfolioLoading } = useQuery(
    'portfolio',
    () => apiClient.portfolio.getCurrent(),
    { refetchInterval: 30000, retry: 2 }
  )

  const { data: portfolioHistory } = useQuery(
    'portfolio-history',
    () => apiClient.portfolio.getHistory(30),
    { refetchInterval: 60000, retry: 1 }
  )

  // Safe data extraction
  const portfolioData = portfolio?.data || {
    total_value: 100000,
    cash: 100000,
    positions_value: 0,
    daily_pnl: 0,
    total_pnl: 0,
    positions: [],
    metrics: {
      total_return_pct: 0,
      sharpe_ratio: 0,
      max_drawdown_pct: 0,
      win_rate: 0
    }
  };

  // Safe allocation data
  const allocationData = [
    { symbol: 'CASH', percentage: 100, value: portfolioData.cash || 100000 }
  ];

  // Safe history data
  const historyData = [
    { date: Date.now() - 30 * 24 * 60 * 60 * 1000, value: 100000 },
    { date: Date.now(), value: portfolioData.total_value || 100000 }
  ];

  const COLORS = ['#00FF9C', '#00D2FF', '#FFB800', '#FF5757', '#9333EA'];

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
            <h1 className="text-3xl font-bold tracking-wider">PORTFOLIO OVERVIEW</h1>
            <p className="text-terminal-muted mt-1">Real-time portfolio performance and allocation</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-terminal-muted">Last Updated</p>
            <p className="text-terminal-secondary">{formatDate(new Date())}</p>
          </div>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Value"
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

        {/* Charts and Tables Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Asset Allocation Chart */}
          <div className="terminal-window">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Asset Allocation
            </h3>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ symbol, percentage }) => `${symbol}: ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentage"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [`${value.toFixed(2)}%`, 'Allocation']}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ 
                      backgroundColor: '#000', 
                      border: '1px solid #333',
                      color: '#00FF9C'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Portfolio History Chart */}
          <div className="terminal-window">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              30-Day Performance
            </h3>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="date" 
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                    stroke="#888"
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value)}
                    stroke="#888"
                  />
                  <Tooltip 
                    labelFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                    formatter={(value: any) => [formatCurrency(value), 'Portfolio Value']}
                    labelStyle={{ color: '#000' }}
                    contentStyle={{ 
                      backgroundColor: '#000', 
                      border: '1px solid #333',
                      color: '#00FF9C'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#00FF9C" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Current Positions Table */}
        <div className="terminal-window">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Current Positions
          </h3>
          
          {Array.isArray(portfolioData.positions) && portfolioData.positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-terminal-border">
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-right py-2">Quantity</th>
                    <th className="text-right py-2">Avg Price</th>
                    <th className="text-right py-2">Market Value</th>
                    <th className="text-right py-2">P&L</th>
                    <th className="text-right py-2">P&L %</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.positions.map((position: any, index: number) => (
                    <tr key={index} className="border-b border-terminal-border/30">
                      <td className="py-2 font-bold text-terminal-secondary">
                        {position.symbol}
                      </td>
                      <td className="text-right py-2">{position.quantity || 0}</td>
                      <td className="text-right py-2">
                        {formatCurrency(position.avg_price || 0)}
                      </td>
                      <td className="text-right py-2">
                        {formatCurrency(position.market_value || 0)}
                      </td>
                      <td className={`text-right py-2 ${getPnLColor(position.unrealized_pnl || 0)}`}>
                        {formatCurrency(position.unrealized_pnl || 0)}
                      </td>
                      <td className={`text-right py-2 ${getPnLColor(position.unrealized_pnl_pct || 0)}`}>
                        {formatPercentage(position.unrealized_pnl_pct || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-terminal-muted">No active positions</p>
              <p className="text-sm text-terminal-muted mt-2">
                Cash Balance: {formatCurrency(portfolioData.cash)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
