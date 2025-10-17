/**
 * Main Layout Component - Dark Pro Mode
 */
import React, { ReactNode } from 'react'
import NavBar from './NavBar'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: ReactNode
  activeTab: string
  onTabChange: (tab: string) => void
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0b0d] text-[#f3f4f6]">
      {/* Top Navigation */}
      <NavBar />
      
      {/* Main Container */}
      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
        
        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6 bg-[#0a0b0d]">
          {children}
        </main>
      </div>
      
      {/* Footer Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-8 bg-[#121417] border-t border-[#1f2937] flex items-center justify-between px-4 text-xs text-[#9ca3af]">
        <div className="flex items-center gap-4">
          <span>Elysian Autonomous Trading System v2.0</span>
          <span className="text-[#10b981]">● Live</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{new Date().toLocaleString()}</span>
          <span className="text-[#3b82f6]">WebSocket: Connected</span>
        </div>
      </div>
    </div>
  )
}
