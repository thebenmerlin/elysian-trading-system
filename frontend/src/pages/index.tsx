/**
 * Elysian Autonomous Trading Terminal
 * Real-time multi-tab terminal interface
 */
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'react-query'

// WebSocket hook for real-time data
const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<any>(null)
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    const connectWS = () => {
      try {
        const wsUrl = url.replace('http', 'ws')
        ws.current = new WebSocket(`${wsUrl}/ws`)
        
        ws.current.onopen = () => {
          setIsConnected(true)
          console.log('WebSocket connected')
          // Subscribe to all channels
          ws.current?.send(JSON.stringify({ type: 'subscribe', data: { channel: 'all' } }))
        }
        
        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            setLastMessage(data)
          } catch (error) {
            console.error('WebSocket message error:', error)
          }
        }
        
        ws.current.onclose = () => {
          setIsConnected(false)
          console.log('WebSocket disconnected')
          // Reconnect after 5 seconds
          setTimeout(connectWS, 5000)
        }
        
        ws.current.onerror = (error) => {
          console.error('WebSocket error:', error)
        }
      } catch (error) {
        console.error('WebSocket connection failed:', error)
        setTimeout(connectWS, 5000)
      }
    }

    connectWS()

    return () => {
      ws.current?.close()
    }
  }, [url])

  return { isConnected, lastMessage }
}

// Terminal component
const TerminalWindow: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-black border border-green-500 rounded-sm font-mono text-sm">
    <div className="bg-green-500 text-black px-3 py-1 font-bold text-xs">
      {title}
    </div>
    <div className="p-3 h-full overflow-auto">
      {children}
    </div>
  </div>
)

// Price ticker component
const PriceTicker: React.FC<{ symbol: string; price: number; change: number; type: string }> = 
  ({ symbol, price, change, type }) => (
    <div className="flex justify-between items-center py-1 border-b border-green-900 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="text-green-400 font-bold">{symbol}</span>
        <span className={`text-xs px-1 py-0.5 rounded ${
          type === 'crypto' ? 'bg-yellow-600 text-black' : 'bg-blue-600 text-white'
        }`}>
          {type.toUpperCase()}
        </span>
      </div>
      <div className="text-right">
        <div className="text-green-400">
          ${price?.toLocaleString(undefined, { 
            minimumFractionDigits: type === 'crypto' && price < 1 ? 4 : 2,
            maximumFractionDigits: type === 'crypto' && price < 1 ? 4 : 2
          })}
        </div>
        <div className={`text-xs ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {change >= 0 ? '+' : ''}{change?.toFixed(2)}%
        </div>
      </div>
    </div>
  )

// Trade log component
const TradeLog: React.FC<{ trade: any }> = ({ trade }) => (
  <div className="flex justify-between items-center py-1 border-b border-green-900 last:border-b-0 text-xs">
    <div className="flex items-center gap-2">
      <span className={`font-bold ${trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
        {trade.side}
      </span>
      <span className="text-green-400">{trade.symbol}</span>
      <span className={`px-1 py-0.5 rounded text-black ${
        trade.asset_type === 'crypto' ? 'bg-yellow-400' : 'bg-blue-400'
      }`}>
        {trade.asset_type?.toUpperCase()}
      </span>
    </div>
    <div className="text-right">
      <div>{trade.quantity} @ ${trade.price?.toFixed(2)}</div>
      <div className="text-green-600">
        {new Date(trade.timestamp).toLocaleTimeString()}
      </div>
    </div>
  </div>
)

// Signal feed component
const SignalFeed: React.FC<{ signal: any }> = ({ signal }) => (
  <div className="border-b border-green-900 last:border-b-0 py-2 text-xs">
    <div className="flex justify-between items-center mb-1">
      <div className="flex items-center gap-2">
        <span className={`font-bold ${
          signal.signal_type === 'BUY' ? 'text-green-400' : 
          signal.signal_type === 'SELL' ? 'text-red-400' : 'text-yellow-400'
        }`}>
          {signal.signal_type}
        </span>
        <span className="text-green-400">{signal.symbol}</span>
        <span className="text-green-600">
          {(signal.confidence * 100)?.toFixed(0)}%
        </span>
      </div>
      <span className="text-green-600">
        {new Date(signal.timestamp).toLocaleTimeString()}
      </span>
    </div>
    <div className="text-green-300 text-xs leading-relaxed">
      {signal.reasoning}
    </div>
  </div>
)

// Main dashboard
export default function AutonomousTerminal() {
  const [activeTab, setActiveTab] = useState(0)
  const [terminalLogs, setTerminalLogs] = useState<string[]>([])
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://elysian-backend-bd3o.onrender.com'
  const { isConnected, lastMessage } = useWebSocket(API_URL)

  // Fetch live data
  const { data: liveAssets } = useQuery(
    'live-assets',
    () => fetch(`${API_URL}/api/assets/live`, {
      headers: { 'x-elysian-key': 'elysian-demo-key' }
    }).then(res => res.json()),
    { refetchInterval: 5000, retry: 1 }
  )

  const { data: recentTrades } = useQuery(
    'recent-trades',
    () => fetch(`${API_URL}/api/trades/recent?limit=20`, {
      headers: { 'x-elysian-key': 'elysian-demo-key' }
    }).then(res => res.json()),
    { refetchInterval: 10000, retry: 1 }
  )

  const { data: recentSignals } = useQuery(
    'recent-signals',
    () => fetch(`${API_URL}/api/signals/recent?limit=15`, {
      headers: { 'x-elysian-key': 'elysian-demo-key' }
    }).then(res => res.json()),
    { refetchInterval: 15000, retry: 1 }
  )

  const { data: portfolioData } = useQuery(
    'portfolio-live',
    () => fetch(`${API_URL}/api/portfolio/live`, {
      headers: { 'x-elysian-key': 'elysian-demo-key' }
    }).then(res => res.json()),
    { refetchInterval: 10000, retry: 1 }
  )

  const { data: systemEvents } = useQuery(
    'system-events',
    () => fetch(`${API_URL}/api/system/events?limit=30`, {
      headers: { 'x-elysian-key': 'elysian-demo-key' }
    }).then(res => res.json()),
    { refetchInterval: 10000, retry: 1 }
  )

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      const timestamp = new Date().toLocaleTimeString()
      let logMessage = ''
      
      switch (lastMessage.type) {
        case 'price_update':
          logMessage = `[${timestamp}] PRICE: ${lastMessage.data.symbol} → $${lastMessage.data.price.toFixed(2)}`
          break
        case 'signal_generated':
          logMessage = `[${timestamp}] SIGNAL: ${lastMessage.data.signal_type} ${lastMessage.data.symbol} (${(lastMessage.data.confidence * 100).toFixed(0)}%)`
          break
        case 'trade_executed':
          logMessage = `[${timestamp}] TRADE: ${lastMessage.data.side} ${lastMessage.data.quantity} ${lastMessage.data.symbol} @ $${lastMessage.data.price.toFixed(2)}`
          break
        case 'system_event':
          logMessage = `[${timestamp}] SYSTEM: ${lastMessage.data.message}`
          break
        default:
          logMessage = `[${timestamp}] ${lastMessage.type}: ${JSON.stringify(lastMessage.data)}`
      }
      
      if (logMessage) {
        setTerminalLogs(prev => [logMessage, ...prev.slice(0, 99)]) // Keep last 100 logs
      }
    }
  }, [lastMessage])

  const tabs = ['DASHBOARD', 'MARKETS', 'SIGNALS', 'TRADES', 'ANALYTICS']
  
  const portfolio = portfolioData?.data
  const assets = liveAssets?.data || []
  const trades = recentTrades?.data || []
  const signals = recentSignals?.data || []
  const events = systemEvents?.data || []

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono text-sm">
      {/* Header */}
      <div className="border-b border-green-500 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-green-400">ELYSIAN AUTONOMOUS TRADING SYSTEM</h1>
            <p className="text-green-600 text-xs mt-1">
              Multi-Asset AI Fund • Real-time WebSocket • By Gajanan Barve
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className={`px-2 py-1 rounded ${isConnected ? 'bg-green-600 text-black' : 'bg-red-600 text-white'}`}>
              WS: {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </div>
            <div className="text-green-400">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex mt-4 border-b border-green-900">
          {tabs.map((tab, index) => (
            <button
              key={tab}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-2 text-xs font-bold transition-colors ${
                activeTab === index
                  ? 'bg-green-500 text-black'
                  : 'text-green-400 hover:text-green-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4 h-[calc(100vh-140px)]">
        <AnimatePresence mode="wait">
          {/* DASHBOARD Tab */}
          {activeTab === 0 && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-12 gap-4 h-full"
            >
              {/* Portfolio Stats */}
              <div className="col-span-4">
                <TerminalWindow title="PORTFOLIO STATUS">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>Total Value:</span>
                      <span className="text-green-400 font-bold">
                        ${portfolio?.total_value?.toLocaleString() || '100,000'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash Balance:</span>
                      <span>${portfolio?.cash_balance?.toLocaleString() || '100,000'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Positions:</span>
                      <span>${portfolio?.positions_value?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total P&L:</span>
                      <span className={portfolio?.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        ${portfolio?.total_pnl?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily P&L:</span>
                      <span className={portfolio?.daily_pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                        ${portfolio?.daily_pnl?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Positions:</span>
                      <span>{portfolio?.positions_count || 0}</span>
                    </div>
                  </div>
                </TerminalWindow>
              </div>

              {/* Live Activity Feed */}
              <div className="col-span-8">
                <TerminalWindow title="LIVE ACTIVITY FEED">
                  <div className="h-full overflow-auto space-y-1">
                    {terminalLogs.length > 0 ? (
                      terminalLogs.map((log, index) => (
                        <div key={index} className="text-xs text-green-300">
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-green-600 text-center py-4">
                        Waiting for live data...
                      </div>
                    )}
                  </div>
                </TerminalWindow>
              </div>
            </motion.div>
          )}

          {/* MARKETS Tab */}
          {activeTab === 1 && (
            <motion.div
              key="markets"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-2 gap-4 h-full"
            >
              <div>
                <TerminalWindow title="CRYPTO MARKETS">
                  <div className="space-y-1">
                    {assets.filter((asset: any) => asset.asset_type === 'crypto').map((asset: any) => (
                      <PriceTicker
                        key={asset.symbol}
                        symbol={asset.symbol}
                        price={asset.price}
                        change={asset.change_24h || 0}
                        type="crypto"
                      />
                    ))}
                  </div>
                </TerminalWindow>
              </div>

              <div>
                <TerminalWindow title="EQUITY MARKETS">
                  <div className="space-y-1">
                    {assets.filter((asset: any) => asset.asset_type === 'equity').map((asset: any) => (
                      <PriceTicker
                        key={asset.symbol}
                        symbol={asset.symbol}
                        price={asset.price}
                        change={asset.change_24h || 0}
                        type="equity"
                      />
                    ))}
                  </div>
                </TerminalWindow>
              </div>
            </motion.div>
          )}

          {/* SIGNALS Tab */}
          {activeTab === 2 && (
            <motion.div
              key="signals"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              <TerminalWindow title="AI REASONING & SIGNALS">
                <div className="h-full overflow-auto">
                  {signals.length > 0 ? (
                    signals.map((signal: any, index: number) => (
                      <SignalFeed key={index} signal={signal} />
                    ))
                  ) : (
                    <div className="text-green-600 text-center py-4">
                      No recent signals
                    </div>
                  )}
                </div>
              </TerminalWindow>
            </motion.div>
          )}

          {/* TRADES Tab */}
          {activeTab === 3 && (
            <motion.div
              key="trades"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full"
            >
              <TerminalWindow title="TRADE EXECUTION LOG">
                <div className="h-full overflow-auto">
                  {trades.length > 0 ? (
                    trades.map((trade: any, index: number) => (
                      <TradeLog key={index} trade={trade} />
                    ))
                  ) : (
                    <div className="text-green-600 text-center py-4">
                      No recent trades
                    </div>
                  )}
                </div>
              </TerminalWindow>
            </motion.div>
          )}

          {/* ANALYTICS Tab */}
          {activeTab === 4 && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-12 gap-4 h-full"
            >
              {/* System Status */}
              <div className="col-span-6">
                <TerminalWindow title="SYSTEM STATUS">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>WebSocket:</span>
                      <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                        {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>AI Engine:</span>
                      <span className="text-green-400">ACTIVE</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Trade Executor:</span>
                      <span className="text-green-400">READY</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Data Sources:</span>
                      <span className="text-green-400">REST + WS</span>
                    </div>
                  </div>
                </TerminalWindow>
              </div>

              {/* System Events */}
              <div className="col-span-6">
                <TerminalWindow title="SYSTEM EVENTS">
                  <div className="h-full overflow-auto space-y-1">
                    {events.map((event: any, index: number) => (
                      <div key={index} className="text-xs">
                        <span className="text-green-600">
                          [{new Date(event.timestamp).toLocaleTimeString()}]
                        </span>
                        <span className={`ml-2 ${
                          event.severity === 'ERROR' ? 'text-red-400' :
                          event.severity === 'WARN' ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {event.event_type}: {typeof event.event_data === 'object' 
                            ? JSON.stringify(event.event_data) 
                            : event.event_data}
                        </span>
                      </div>
                    ))}
                  </div>
                </TerminalWindow>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
