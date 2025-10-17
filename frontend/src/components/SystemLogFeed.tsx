/**
 * System Log Feed - Real-time Event Stream
 */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, AlertTriangle, Info, Activity, Zap, TrendingUp } from 'lucide-react'

interface SystemEvent {
  id: number
  event_type: string
  event_data: any
  severity: 'INFO' | 'WARN' | 'ERROR'
  timestamp: string
}

interface SystemLogFeedProps {
  events: SystemEvent[]
  wsMessages: any[]
}

export default function SystemLogFeed({ events, wsMessages }: SystemLogFeedProps) {
  const [filter, setFilter] = useState<'ALL' | 'ERROR' | 'WARN' | 'TRADE' | 'SIGNAL'>('ALL')
  const [logs, setLogs] = useState<any[]>([])
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Combine backend events with WebSocket messages
    const combinedLogs = [
      ...events.map(e => ({
        ...e,
        source: 'backend'
      })),
      ...wsMessages.map((msg, index) => ({
        id: `ws-${index}`,
        event_type: msg.type || 'WS_MESSAGE',
        event_data: msg.data,
        severity: 'INFO',
        timestamp: new Date(msg.timestamp || Date.now()).toISOString(),
        source: 'websocket'
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    setLogs(combinedLogs)
  }, [events, wsMessages])

  const filteredLogs = logs.filter(log => {
    if (filter === 'ALL') return true
    if (filter === 'ERROR') return log.severity === 'ERROR'
    if (filter === 'WARN') return log.severity === 'WARN'
    if (filter === 'TRADE') return log.event_type.includes('TRADE')
    if (filter === 'SIGNAL') return log.event_type.includes('SIGNAL')
    return true
  })

  const getLogIcon = (eventType: string, severity: string) => {
    if (severity === 'ERROR') return <AlertCircle className="w-4 h-4 text-[#ef4444]" />
    if (severity === 'WARN') return <AlertTriangle className="w-4 h-4 text-yellow-500" />
    if (eventType.includes('TRADE')) return <TrendingUp className="w-4 h-4 text-[#10b981]" />
    if (eventType.includes('SIGNAL')) return <Zap className="w-4 h-4 text-[#3b82f6]" />
    if (eventType.includes('ACTIVITY')) return <Activity className="w-4 h-4 text-[#9ca3af]" />
    return <Info className="w-4 h-4 text-[#9ca3af]" />
  }

  const getLogColor = (severity: string) => {
    if (severity === 'ERROR') return 'text-[#ef4444]'
    if (severity === 'WARN') return 'text-yellow-500'
    return 'text-[#9ca3af]'
  }

  return (
    <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] overflow-hidden h-full flex flex-col">
      {/* Header with Filters */}
      <div className="px-6 py-4 border-b border-[#1f2937] flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#f3f4f6]">System Activity Feed</h2>
        <div className="flex gap-2">
          {['ALL', 'ERROR', 'WARN', 'TRADE', 'SIGNAL'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                filter === f
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#1f2937] text-[#9ca3af] hover:bg-[#374151]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Log Feed */}
      <div 
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs"
      >
        <AnimatePresence mode="popLayout">
          {filteredLogs.slice(0, 100).map((log, index) => (
            <motion.div
              key={log.id || index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-[#0a0b0d] border border-[#1f2937] hover:border-[#3b82f6]/30 transition-colors"
            >
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getLogIcon(log.event_type, log.severity)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-semibold ${getLogColor(log.severity)}`}>
                    {log.event_type}
                  </span>
                  <span className="text-[#9ca3af]">•</span>
                  <span className="text-[#9ca3af]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  {log.source === 'websocket' && (
                    <span className="px-1.5 py-0.5 bg-[#3b82f6]/10 text-[#3b82f6] text-xs rounded">
                      WS
                    </span>
                  )}
                </div>
                <div className="text-[#f3f4f6] break-words">
                  {typeof log.event_data === 'object' 
                    ? JSON.stringify(log.event_data, null, 2)
                    : log.event_data || 'No additional data'}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-[#9ca3af]">
            No {filter.toLowerCase()} events to display
          </div>
        )}
      </div>
    </div>
  )
}
