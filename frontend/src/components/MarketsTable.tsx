/**
 * Markets Table - Crypto & Equity Prices
 */
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Asset {
  symbol: string
  asset_type: 'crypto' | 'equity'
  price: number
  change_24h: number
  volume: number
  data_source: string
}

interface MarketsTableProps {
  assets: Asset[]
}

export default function MarketsTable({ assets }: MarketsTableProps) {
  const [activeTab, setActiveTab] = useState<'crypto' | 'equity'>('crypto')
  
  const filteredAssets = assets.filter(asset => asset.asset_type === activeTab)

  return (
    <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-[#1f2937]">
        <button
          onClick={() => setActiveTab('crypto')}
          className={`flex-1 px-6 py-4 font-semibold transition-all ${
            activeTab === 'crypto'
              ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-b-2 border-[#3b82f6]'
              : 'text-[#9ca3af] hover:text-[#f3f4f6]'
          }`}
        >
          Crypto Markets
        </button>
        <button
          onClick={() => setActiveTab('equity')}
          className={`flex-1 px-6 py-4 font-semibold transition-all ${
            activeTab === 'equity'
              ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-b-2 border-[#3b82f6]'
              : 'text-[#9ca3af] hover:text-[#f3f4f6]'
          }`}
        >
          Equity Markets
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0a0b0d]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Symbol</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">24h Change</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Volume</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[#9ca3af] uppercase tracking-wider">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f2937]">
            {filteredAssets.map((asset, index) => (
              <motion.tr
                key={asset.symbol}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-[#1f2937]/50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-semibold text-[#f3f4f6]">{asset.symbol}</div>
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                      asset.asset_type === 'crypto' 
                        ? 'bg-yellow-500/10 text-yellow-500' 
                        : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {asset.asset_type.toUpperCase()}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono text-[#f3f4f6]">
                  ${asset.price.toLocaleString(undefined, {
                    minimumFractionDigits: asset.asset_type === 'crypto' && asset.price < 1 ? 4 : 2,
                    maximumFractionDigits: asset.asset_type === 'crypto' && asset.price < 1 ? 4 : 2
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className={`flex items-center justify-end gap-1 text-sm font-semibold ${
                    asset.change_24h >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'
                  }`}>
                    {asset.change_24h >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {asset.change_24h >= 0 ? '+' : ''}{asset.change_24h.toFixed(2)}%
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-[#9ca3af] font-mono">
                  {asset.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-xs text-[#9ca3af]">
                  {asset.data_source}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
