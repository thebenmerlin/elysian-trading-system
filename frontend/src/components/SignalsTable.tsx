/**
 * AI Signals Table - Live Trading Signals
 */
import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'

interface Signal {
  id: number
  symbol: string
  asset_type: 'crypto' | 'equity'
  signal_type: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string
  price_at_signal: number
  timestamp: string
  executed: boolean
}

interface SignalsTableProps {
  signals: Signal[]
}

export default function SignalsTable({ signals }: SignalsTableProps) {
  return (
    <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1f2937] flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#f3f4f6]">AI Trading Signals</h2>
        <div className="text-xs text-[#9ca3af]">Real-time AI reasoning</div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0a0b0d]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Symbol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Signal</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Confidence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Reasoning</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f2937]">
            {signals.map((signal, index) => {
              const confidenceColor = 
                signal.confidence >= 0.7 ? 'text-[#10b981]' : 
                signal.confidence >= 0.5 ? 'text-yellow-500' : 'text-[#9ca3af]'
              
              return (
                <motion.tr
                  key={signal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`hover:bg-[#1f2937]/50 cursor-pointer transition-colors ${
                    signal.confidence < 0.5 ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#f3f4f6]">{signal.symbol}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        signal.asset_type === 'crypto' 
                          ? 'bg-yellow-500/10 text-yellow-500' 
                          : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {signal.asset_type}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`flex items-center gap-2 font-bold text-sm ${
                      signal.signal_type === 'BUY' ? 'text-[#10b981]' : 
                      signal.signal_type === 'SELL' ? 'text-[#ef4444]' : 'text-[#9ca3af]'
                    }`}>
                      {signal.signal_type === 'BUY' && <TrendingUp className="w-4 h-4" />}
                      {signal.signal_type === 'SELL' && <TrendingDown className="w-4 h-4" />}
                      {signal.signal_type === 'HOLD' && <Minus className="w-4 h-4" />}
                      {signal.signal_type}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className={`text-sm font-semibold ${confidenceColor}`}>
                      {(signal.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 max-w-xs">
                      <Info className="w-3 h-3 text-[#9ca3af] flex-shrink-0" />
                      <span className="text-xs text-[#9ca3af] truncate" title={signal.reasoning}>
                        {signal.reasoning}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-[#f3f4f6]">
                    ${signal.price_at_signal.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-[#9ca3af]">
                    {new Date(signal.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`px-2 py-1 text-xs rounded ${
                      signal.executed 
                        ? 'bg-[#10b981]/10 text-[#10b981]' 
                        : 'bg-[#9ca3af]/10 text-[#9ca3af]'
                    }`}>
                      {signal.executed ? 'Executed' : 'Pending'}
                    </span>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
