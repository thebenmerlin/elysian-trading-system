/**
 * Test Trade Button - Manual Trade Execution
 */
import React, { useState } from 'react'
import { Play, Loader } from 'lucide-react'
import { motion } from 'framer-motion'

interface TestTradeButtonProps {
  apiUrl: string
  apiKey: string
  onTradeExecuted?: (result: any) => void
}

export default function TestTradeButton({ apiUrl, apiKey, onTradeExecuted }: TestTradeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const executeTestTrade = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch(`${apiUrl}/api/test/trade`, {
        method: 'POST',
        headers: {
          'x-elysian-key': apiKey,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      setResult(data)

      if (onTradeExecuted) {
        onTradeExecuted(data)
      }

      // Auto-clear after 5 seconds
      setTimeout(() => setResult(null), 5000)
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error - could not execute test trade'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <motion.button
        onClick={executeTestTrade}
        disabled={loading}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`w-full px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
          loading
            ? 'bg-[#9ca3af] cursor-not-allowed'
            : 'bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:shadow-lg hover:shadow-[#3b82f6]/50'
        }`}
      >
        {loading ? (
          <>
            <Loader className="w-5 h-5 animate-spin" />
            Executing...
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            Execute Test Trade
          </>
        )}
      </motion.button>

      {/* Result Toast */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`p-4 rounded-lg border ${
            result.success
              ? 'bg-[#10b981]/10 border-[#10b981] text-[#10b981]'
              : 'bg-[#ef4444]/10 border-[#ef4444] text-[#ef4444]'
          }`}
        >
          <div className="font-semibold mb-1">
            {result.success ? '✅ Trade Executed Successfully' : '⚠️ Trade Rejected'}
          </div>
          <div className="text-sm opacity-90">
            {result.message}
          </div>
          {result.trade && (
            <div className="mt-2 text-xs font-mono opacity-75">
              {result.trade.side} {result.trade.quantity} {result.trade.symbol} @ ${result.trade.price}
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
