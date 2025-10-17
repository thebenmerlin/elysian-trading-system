/**
 * Analytics Charts - Portfolio Performance Visualizations
 */
import React from 'react'
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts'

interface Trade {
  timestamp: string
  pnl_realized: number
}

interface Signal {
  signal_type: string
  executed: boolean
}

interface AnalyticsChartsProps {
  trades: Trade[]
  signals: Signal[]
  positions: any[]
}

export default function AnalyticsCharts({ trades, signals, positions }: AnalyticsChartsProps) {
  // Cumulative PnL Data
  const pnlData = trades
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .reduce((acc, trade, index) => {
      const cumulative = index > 0 ? acc[index - 1].cumulative + trade.pnl_realized : trade.pnl_realized
      acc.push({
        time: new Date(trade.timestamp).toLocaleTimeString(),
        cumulative: cumulative
      })
      return acc
    }, [] as any[])

  // Signal Accuracy Data
  const executedSignals = signals.filter(s => s.executed).length
  const totalSignals = signals.length
  const signalAccuracyData = [
    { name: 'Executed', value: executedSignals, color: '#10b981' },
    { name: 'Pending', value: totalSignals - executedSignals, color: '#9ca3af' }
  ]

  // Asset Allocation Data
  const totalValue = positions.reduce((sum, p) => sum + p.market_value, 0)
  const allocationData = positions.map(p => ({
    name: p.symbol,
    value: p.market_value,
    percentage: ((p.market_value / totalValue) * 100).toFixed(1)
  }))

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Cumulative PnL Chart */}
      <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
        <h3 className="text-lg font-semibold text-[#f3f4f6] mb-4">Cumulative P&L</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={pnlData}>
            <XAxis 
              dataKey="time" 
              stroke="#9ca3af" 
              style={{ fontSize: '10px' }}
              tick={{ fill: '#9ca3af' }}
            />
            <YAxis 
              stroke="#9ca3af" 
              style={{ fontSize: '10px' }}
              tick={{ fill: '#9ca3af' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#121417', 
                border: '1px solid #1f2937',
                borderRadius: '8px',
                color: '#f3f4f6'
              }}
              formatter={(value: any) => [`$${value.toFixed(2)}`, 'P&L']}
            />
            <Line 
              type="monotone" 
              dataKey="cumulative" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Signal Accuracy Pie Chart */}
      <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
        <h3 className="text-lg font-semibold text-[#f3f4f6] mb-4">Signal Execution Rate</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={signalAccuracyData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {signalAccuracyData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#121417', 
                border: '1px solid #1f2937',
                borderRadius: '8px',
                color: '#f3f4f6'
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => <span style={{ color: '#f3f4f6' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="text-center mt-4">
          <div className="text-2xl font-bold text-[#3b82f6]">
            {totalSignals > 0 ? ((executedSignals / totalSignals) * 100).toFixed(1) : 0}%
          </div>
          <div className="text-xs text-[#9ca3af]">Execution Rate</div>
        </div>
      </div>

      {/* Asset Allocation Donut */}
      <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
        <h3 className="text-lg font-semibold text-[#f3f4f6] mb-4">Asset Allocation</h3>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={allocationData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              label={({ percentage }) => `${percentage}%`}
            >
              {allocationData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#121417', 
                border: '1px solid #1f2937',
                borderRadius: '8px',
                color: '#f3f4f6'
              }}
              formatter={(value: any) => [`$${value.toLocaleString()}`, 'Value']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 space-y-2">
          {allocationData.slice(0, 3).map((item, index) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-[#f3f4f6]">{item.name}</span>
              </div>
              <span className="text-[#9ca3af]">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
