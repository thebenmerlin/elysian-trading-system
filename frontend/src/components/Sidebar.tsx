/**
 * Sidebar Navigation - Dark Pro
 */
import React from 'react'
import { LayoutDashboard, TrendingUp, Zap, Briefcase, BarChart3, Settings } from 'lucide-react'
import { motion } from 'framer-motion'

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'markets', label: 'Markets', icon: TrendingUp },
  { id: 'signals', label: 'Signals', icon: Zap },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'system', label: 'System', icon: Settings },
]

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-[#121417]/70 backdrop-blur-lg border-r border-[#1f2937] flex flex-col">
      <div className="flex-1 p-4 space-y-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${
                isActive
                  ? 'bg-[#3b82f6]/10 text-[#3b82f6] shadow-lg shadow-[#3b82f6]/20'
                  : 'text-[#9ca3af] hover:bg-[#1f2937] hover:text-[#f3f4f6]'
              }`}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 w-1 h-full bg-[#3b82f6] rounded-r"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className="w-5 h-5" />
              <span className="font-medium">{tab.label}</span>
            </motion.button>
          )
        })}
      </div>
    </aside>
  )
}
