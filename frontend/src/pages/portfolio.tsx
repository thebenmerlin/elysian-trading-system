/**
 * Elysian Trading System - Portfolio Page
 * Detailed portfolio view with positions and performance
 */

import React from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { apiClient, formatCurrency, formatPercentage, getPnLColor, formatDate } from '@/utils/api'
import { TrendingUp, PieChart as PieChartIcon, DollarSign, Target } from 'lucide-react'

export default function Portfolio() {
  const { data: portfolio, isLoading: portfolioLoading } = useQuery(
    'portfolio-detailed',
    () => apiClient.portfolio.getCurrent(),
    { refetchInterval: 30000 }
  )

  const { data: positions } = useQuery(
    'positions',
    () => apiClient.portfolio.getPositions(),
    { refetchInterval: 30000 }
  )

  const { data: history } = useQuery(
    'portfolio-history',
    () => apiClient.portfolio.getHistory(30),
    { refetchInterval: 60000 }
  )

  const portfolioData = portfolio?.data
  const positionsData = positions?.data?.data || []
  const historyData = history?.data?.data || []

  // Process data for charts
  const equityData = historyData.map((snapshot: any) => ({
    date: new Date(snapshot.timestamp).toLocaleDateString(),
    value: snapshot.total_value,
    pnl: snapshot.total_pnl
  })).reverse()

  const allocationData = Object.entries(portfolioData?.allocation || {}).map(([symbol, percentage]: [string, any]) => ({
    symbol,
    percentage: Number(percentage),
    value: (Number(percentage) / 100) * (portfolioData?.total_value || 0)
  })).filter(item => item.percentage > 0)

  const COLORS = ['#00FF9C', '#00D2FF', '#FFB800', '#FF5757', '#888888']

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
            <h1 className="text-3xl font-mono font-bold text-terminal-primary mb-2">
              PORTFOLIO ANALYSIS
            </h1>
            <p className="text-terminal-muted font-mono">
              Current positions and performance metrics
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-mono font-bold">
              {portfolioData ? formatCurrency(portfolioData.total_value) : '--'}
            </div>
            <div className={`text-sm font-mono ${getPnLColor(portfolioData?.daily_pnl || 0)}`}>
              {portfolioData?.daily_pnl ? formatCurrency(portfolioData.daily_pnl) : '--'} today
            </div>
          </div>
        </motion.div>

        {/* Performance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="metric-card">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-4 h-4 text-terminal-primary" />
              <span className="text-terminal-muted text-sm font-mono">TOTAL VALUE</span>
            </div>
            <div className="text-xl font-mono font-bold">
              {portfolioData ? formatCurrency(portfolioData.total_value) : '--'}
            </div>
          </div>

          <div className="metric-card">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-terminal-primary" />
              <span className="text-terminal-muted text-sm font-mono">TOTAL RETURN</span>
            </div>
            <div className={`text-xl font-mono font-bold ${getPnLColor(portfolioData?.metrics?.total_return_pct || 0)}`}>
              {portfolioData?.metrics ? formatPercentage(portfolioData.metrics.total_return_pct) : '--'}
            </div>
          </div>

          <div className="metric-card">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-4 h-4 text-terminal-primary" />
              <span className="text-terminal-muted text-sm font-mono">SHARPE RATIO</span>
            </div>
            <div className="text-xl font-mono font-bold">
              {portfolioData?.metrics ? portfolioData.metrics.sharpe_ratio.toFixed(2) : '--'}
            </div>
          </div>

          <div className="metric-card">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-terminal-primary">📉</span>
              <span className="text-terminal-muted text-sm font-mono">MAX DRAWDOWN</span>
            </div>
            <div className="text-xl font-mono font-bold text-terminal-error">
              {portfolioData?.metrics ? `${portfolioData.metrics.max_drawdown_pct.toFixed(1)}%` : '--'}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Equity Curve */}
          <div className="chart-container">
            <h3 className="text-lg font-mono font-bold text-terminal-primary mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Equity Curve (30 Days)
            </h3>
            {equityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={equityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#00FF9C" />
                  <YAxis 
                    stroke="#00FF9C"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
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
            ) : (
              <div className="h-[300px] flex items-center justify-center text-terminal-muted">
                No historical data available
              </div>
            )}
          </div>

          {/* Asset Allocation */}
          <div className="chart-container">
            <h3 className="text-lg font-mono font-bold text-terminal-primary mb-4 flex items-center">
              <PieChartIcon className="w-5 h-5 mr-2" />
              Asset Allocation
            </h3>
            {allocationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ symbol, percentage }) => `${symbol} ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentage"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-terminal-muted">
                No positions to display
              </div>
            )}
          </div>
        </div>

        {/* Positions Table */}
        <div className="terminal-window">
          <div className="terminal-header">
            <div className="terminal-dot red"></div>
            <div className="terminal-dot yellow"></div>
            <div className="terminal-dot green"></div>
            <div className="ml-4 text-terminal-muted text-sm font-mono">Current Positions</div>
          </div>
          <div className="terminal-content">
            {positionsData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="terminal-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Quantity</th>
                      <th>Avg Price</th>
                      <th>Current Price</th>
                      <th>Market Value</th>
                      <th>P&L</th>
                      <th>P&L %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positionsData.map((position: any) => (
                      <tr key={position.symbol}>
                        <td className="font-bold text-terminal-primary">{position.symbol}</td>
                        <td>{position.quantity.toLocaleString()}</td>
                        <td>{formatCurrency(position.avg_price)}</td>
                        <td>{formatCurrency(position.current_price)}</td>
                        <td>{formatCurrency(position.market_value)}</td>
                        <td className={getPnLColor(position.unrealized_pnl)}>
                          {formatCurrency(position.unrealized_pnl)}
                        </td>
                        <td className={getPnLColor(position.unrealized_pnl_pct)}>
                          {formatPercentage(position.unrealized_pnl_pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center text-terminal-muted py-8">
                <div className="text-lg mb-2">📊</div>
                <div>No open positions</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
