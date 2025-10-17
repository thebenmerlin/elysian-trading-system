/**
 * Elysian Trader - Main Dashboard
 * Dark Pro Mode - Complete Integration
 */
import React, { useState, useEffect, useRef } from 'react'
import { useQuery } from 'react-query'
import Layout from '@/components/Layout'
import KPIGrid from '@/components/KPIGrid'
import MarketsTable from '@/components/MarketsTable'
import SignalsTable from '@/components/SignalsTable'
import PortfolioTable from '@/components/PortfolioTable'
import AnalyticsCharts from '@/components/AnalyticsCharts'
import SystemLogFeed from '@/components/SystemLogFeed'
import TestTradeButton from '@/components/TestTradeButton'

// WebSocket Hook
const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    const connectWS = () => {
      try {
        const wsUrl = url.replace('http', 'ws')
        ws.current = new WebSocket(`${wsUrl}/ws`)
        
        ws.current.onopen = () => {
          setIsConnected(true)
          ws.current?.send(JSON.stringify({ type: 'subscribe', data: { channel: 'all' } }))
        }
        
        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            setMessages(prev => [data, ...prev.slice(0, 99)])
          } catch (error) {
            console.error('WebSocket message error:', error)
          }
        }
        
        ws.current.onclose = () => {
          setIsConnected(false)
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

  return { isConnected, messages }
}

export default function ElysianDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://elysian-backend-bd3o.onrender.com'
  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'elysian-demo-key'
  
  const { isConnected, messages: wsMessages } = useWebSocket(API_URL)

  // API Queries
  const { data: assetsData } = useQuery(
    'assets-live',
    () => fetch(`${API_URL}/api/assets/live`, {
      headers: { 'x-elysian-key': API_KEY }
    }).then(res => res.json()),
    { refetchInterval: 5000, retry: 1 }
  )

  const { data: signalsData } = useQuery(
    'signals-recent',
    () => fetch(`${API_URL}/api/signals/recent?limit=15`, {
      headers: { 'x-elysian-key': API_KEY }
    }).then(res => res.json()),
    { refetchInterval: 15000, retry: 1 }
  )

  const { data: tradesData } = useQuery(
    'trades-recent',
    () => fetch(`${API_URL}/api/trades/recent?limit=20`, {
      headers: { 'x-elysian-key': API_KEY }
    }).then(res => res.json()),
    { refetchInterval: 10000, retry: 1 }
  )

  const { data: portfolioData } = useQuery(
    'portfolio-live',
    () => fetch(`${API_URL}/api/portfolio/live`, {
      headers: { 'x-elysian-key': API_KEY }
    }).then(res => res.json()),
    { refetchInterval: 10000, retry: 1 }
  )

  const { data: eventsData } = useQuery(
    'system-events',
    () => fetch(`${API_URL}/api/system/events?limit=50`, {
      headers: { 'x-elysian-key': API_KEY }
    }).then(res => res.json()),
    { refetchInterval: 10000, retry: 1 }
  )

  // Extract data
  const assets = assetsData?.data || []
  const signals = signalsData?.data || []
  const trades = tradesData?.data || []
  const portfolio = portfolioData?.data || { 
    total_value: 100000, 
    cash_balance: 100000, 
    positions: [],
    daily_pnl: 0,
    positions_count: 0
  }
  const events = eventsData?.data || []

  // Calculate KPIs
  const signalsToday = signals.filter((s: any) => {
    const signalDate = new Date(s.timestamp)
    const today = new Date()
    return signalDate.toDateString() === today.toDateString()
  }).length

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <KPIGrid
            portfolioValue={portfolio.total_value}
            dailyPnL={portfolio.daily_pnl || 0}
            activePositions={portfolio.positions_count || 0}
            signalsToday={signalsToday}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <MarketsTable assets={assets} />
            </div>
            <div className="h-[600px]">
              <SystemLogFeed events={events} wsMessages={wsMessages} />
            </div>
          </div>
        </div>
      )}

      {/* Markets Tab */}
      {activeTab === 'markets' && (
        <div className="space-y-6">
          <MarketsTable assets={assets} />
        </div>
      )}

      {/* Signals Tab */}
      {activeTab === 'signals' && (
        <div className="space-y-6">
          <SignalsTable signals={signals} />
          <div className="max-w-md">
            <div className="bg-[#121417]/70 backdrop-blur-lg rounded-xl border border-[#1f2937] p-6">
              <h3 className="text-lg font-semibold text-[#f3f4f6] mb-4">Manual Trade Execution</h3>
              <TestTradeButton 
                apiUrl={API_URL} 
                apiKey={API_KEY}
                onTradeExecuted={(result) => {
                  console.log('Trade executed:', result)
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div className="space-y-6">
          <PortfolioTable
            positions={portfolio.positions || []}
            cashBalance={portfolio.cash_balance || 100000}
            totalValue={portfolio.total_value || 100000}
          />
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <AnalyticsCharts
            trades={trades}
            signals={signals}
            positions={portfolio.positions || []}
          />
        </div>
      )}

      {/* System Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="h-[700px]">
            <SystemLogFeed events={events} wsMessages={wsMessages} />
          </div>
        </div>
      )}
    </Layout>
  )
}
