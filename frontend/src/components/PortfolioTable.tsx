/**
 * Portfolio Table - Active Positions
 */
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Position {
  symbol: string
  asset_type: 'crypto' | 'equity'
  quantity: number
  avg_price: number
  current_price: number
  market_value: number
  unrealized_pnl: number
}

interface PortfolioTableProps {
  positions: Position[]
  cashBalance: number
  totalValue: number
}

export default function PortfolioTable({ positions, cashBalance, totalValue }: PortfolioTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const toggleRow = (symbol: string) => {
    setExpandedRow(expandedRow === symbol ? null : symbol)
  }

  return (
    <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1f2937] flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#f3f4f6]">Portfolio Positions</h2>
        <div className="flex items-center gap-6 text-sm">
          <div className="text-[#9ca3af]">
            Cash: <span className="text-[#f3f4f6] font-semibold">${cashBalance.toLocaleString()}</span>
          </div>
          <div className="text-[#9ca3af]">
            Total: <span className="text-[#3b82f6] font-semibold">${totalValue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0a0b0d]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Symbol</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Entry Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Current Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Market Value</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Unrealized P&L</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">% Change</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f2937]">
            {positions.length > 0 ? (
              positions.map((position, index) => {
                const percentChange = ((position.current_price - position.avg_price) / position.avg_price) * 100
                const isExpanded = expandedRow === position.symbol

                return (
                  <React.Fragment key={position.symbol}>
                    <motion.tr
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-[#1f2937]/50 cursor-pointer transition-colors"
                      onClick={() => toggleRow(position.symbol)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#f3f4f6]">{position.symbol}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            position.asset_type === 'crypto' 
                              ? 'bg-yellow-500/10 text-yellow-500' 
                              : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            {position.asset_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-[#f3f4f6]">
                        {position.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-[#9ca3af]">
                        ${position.avg_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-[#f3f4f6]">
                        ${position.current_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-[#f3f4f6]">
                        ${position.market_value.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-semibold ${
                          position.unrealized_pnl >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}>
                          {position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-semibold ${
                          percentChange >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                        }`}>
                          {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button className="text-[#3b82f6] hover:text-[#60a5fa] transition-colors">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </motion.tr>

                    {/* Expanded Row */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <td colSpan={8} className="px-6 py-4 bg-[#0a0b0d]">
                            <div className="text-xs text-[#9ca3af] space-y-2">
                              <div className="grid grid-cols-4 gap-4">
                                <div>
                                  <div className="text-[#9ca3af] mb-1">Cost Basis</div>
                                  <div className="text-[#f3f4f6] font-semibold">
                                    ${(position.quantity * position.avg_price).toFixed(2)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[#9ca3af] mb-1">Allocation</div>
                                  <div className="text-[#f3f4f6] font-semibold">
                                    {((position.market_value / totalValue) * 100).toFixed(2)}%
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[#9ca3af] mb-1">Asset Type</div>
                                  <div className="text-[#f3f4f6] font-semibold capitalize">
                                    {position.asset_type}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[#9ca3af] mb-1">Trade History</div>
                                  <button className="text-[#3b82f6] hover:underline font-semibold">
                                    View Trades →
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                )
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[#9ca3af]">
                  No active positions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
