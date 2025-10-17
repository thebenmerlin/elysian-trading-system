/**
 * Navigation Bar - Dark Pro
 */
import React from 'react'
import { Activity, Database, Cpu, TrendingUp } from 'lucide-react'

export default function NavBar() {
  return (
    <nav className="h-16 bg-[#121417]/70 backdrop-blur-lg border-b border-[#1f2937] flex items-center justify-between px-6 sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] rounded-lg flex items-center justify-center">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#f3f4f6]">Elysian Trader</h1>
          <p className="text-xs text-[#9ca3af]">AI-Powered Autonomous Fund</p>
        </div>
      </div>
      
      {/* Status Indicators */}
      <div className="flex items-center gap-6">
        {/* Render Status */}
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#10b981]" />
          <div>
            <div className="text-xs text-[#9ca3af]">Backend</div>
            <div className="text-xs font-semibold text-[#10b981]">Render ✓</div>
          </div>
        </div>
        
        {/* Database Status */}
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#10b981]" />
          <div>
            <div className="text-xs text-[#9ca3af]">Database</div>
            <div className="text-xs font-semibold text-[#10b981]">Neon ✓</div>
          </div>
        </div>
        
        {/* AI Engine Status */}
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#3b82f6] animate-pulse" />
          <div>
            <div className="text-xs text-[#9ca3af]">AI Engine</div>
            <div className="text-xs font-semibold text-[#3b82f6]">Active 🧠</div>
          </div>
        </div>
      </div>
    </nav>
  )
}
