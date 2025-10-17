/**
 * Elysian Trading System - Reflections Page
 * AI-powered trading insights and recommendations
 */

import React from 'react'
import { useQuery } from 'react-query'
import { motion } from 'framer-motion'
import { toast } from 'react-hot-toast'
import { apiClient, formatDate, formatCurrency, formatPercentage } from '@/utils/api'
import { Brain, TrendingUp, AlertTriangle, Target, RefreshCw } from 'lucide-react'

// Define interfaces for type safety
interface PerformanceSummary {
  total_return_pct: number
  sharpe_ratio: number
  max_drawdown_pct: number
  win_rate_pct: number
}

interface Mistake {
  category: string
  frequency: number
  impact_pnl: number
  description: string
  examples: string[]
}

interface Recommendation {
  area: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  reasoning: string
  current_value: string | number
  recommended_value: string | number
}

interface Reflection {
  id: string
  timestamp: string
  confidence_score: number
  performance_summary: PerformanceSummary
  mistakes_identified: Mistake[]
  successful_patterns: string[]
  key_insights: string[]
  recommended_adjustments: Recommendation[]
  future_focus_areas: string[]
}

export default function Reflections() {
  const { data: reflections, refetch } = useQuery(
    'reflections-history',
    () => apiClient.reflections.getAll(20),
    { refetchInterval: 300000 }
  )

  // Handle unknown response type safely
  const reflectionsData: Reflection[] = (reflections as any)?.data?.data || []

  const handleGenerateReflection = async () => {
    try {
      toast.loading('Generating AI reflection...', { id: 'reflection' })
      await apiClient.reflections.generate(7)
      await refetch()
      toast.success('AI reflection generated successfully', { id: 'reflection' })
    } catch (error) {
      toast.error('Failed to generate reflection', { id: 'reflection' })
    }
  }

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.8) return 'text-terminal-primary'
    if (score >= 0.6) return 'text-terminal-warning'
    return 'text-terminal-error'
  }

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'HIGH': return 'text-terminal-error'
      case 'MEDIUM': return 'text-terminal-warning'
      case 'LOW': return 'text-terminal-muted'
      default: return 'text-terminal-muted'
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-mono font-bold text-terminal-primary mb-2">
              AI REFLECTIONS
            </h1>
            <p className="text-terminal-muted font-mono">
              Autonomous system analysis and optimization recommendations
            </p>
          </div>

          <button
            onClick={handleGenerateReflection}
            className="btn-terminal flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>GENERATE REFLECTION</span>
          </button>
        </motion.div>

        {/* Latest Reflection Summary */}
        {reflectionsData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="metric-card">
              <div className="flex items-center space-x-2 mb-2">
                <Brain className="w-4 h-4 text-terminal-primary" />
                <span className="text-terminal-muted text-sm font-mono">CONFIDENCE</span>
              </div>
              <div className={`text-xl font-mono font-bold ${getConfidenceColor(reflectionsData[0].confidence_score)}`}>
                {(reflectionsData[0].confidence_score * 100).toFixed(0)}%
              </div>
            </div>

            <div className="metric-card">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-terminal-primary" />
                <span className="text-terminal-muted text-sm font-mono">WIN RATE</span>
              </div>
              <div className="text-xl font-mono font-bold">
                {reflectionsData[0].performance_summary.win_rate_pct.toFixed(1)}%
              </div>
            </div>

            <div className="metric-card">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-terminal-warning" />
                <span className="text-terminal-muted text-sm font-mono">MISTAKES</span>
              </div>
              <div className="text-xl font-mono font-bold text-terminal-warning">
                {reflectionsData[0].mistakes_identified.length}
              </div>
            </div>

            <div className="metric-card">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="w-4 h-4 text-terminal-primary" />
                <span className="text-terminal-muted text-sm font-mono">PATTERNS</span>
              </div>
              <div className="text-xl font-mono font-bold">
                {reflectionsData[0].successful_patterns.length}
              </div>
            </div>
          </div>
        )}

        {/* Reflections List */}
        <div className="space-y-6">
          {reflectionsData.length > 0 ? (
            reflectionsData.map((reflection) => (
              <motion.div
                key={reflection.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="terminal-window"
              >
                <div className="terminal-header">
                  <div className="terminal-dot red"></div>
                  <div className="terminal-dot yellow"></div>
                  <div className="terminal-dot green"></div>
                  <div className="ml-4 text-terminal-muted text-sm font-mono">
                    Reflection - {formatDate(reflection.timestamp)} 
                    <span className={`ml-4 ${getConfidenceColor(reflection.confidence_score)}`}>
                      Confidence: {(reflection.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="terminal-content space-y-6">

                  {/* Performance Summary */}
                  <div>
                    <h3 className="text-lg font-mono font-bold text-terminal-primary mb-3 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Performance Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-mono">
                      <div>
                        <span className="text-terminal-muted">Total Return:</span>
                        <span className="ml-2 font-bold">
                          {formatPercentage(reflection.performance_summary.total_return_pct)}
                        </span>
                      </div>
                      <div>
                        <span className="text-terminal-muted">Sharpe Ratio:</span>
                        <span className="ml-2 font-bold">
                          {reflection.performance_summary.sharpe_ratio.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-terminal-muted">Max Drawdown:</span>
                        <span className="ml-2 font-bold text-terminal-error">
                          {reflection.performance_summary.max_drawdown_pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Key Insights */}
                  {reflection.key_insights.length > 0 && (
                    <div>
                      <h3 className="text-lg font-mono font-bold text-terminal-primary mb-3 flex items-center">
                        <Brain className="w-5 h-5 mr-2" />
                        Key Insights
                      </h3>
                      <div className="space-y-2">
                        {reflection.key_insights.map((insight, index) => (
                          <div key={index} className="flex items-start space-x-2 text-sm font-mono">
                            <span className="text-terminal-primary mt-1">•</span>
                            <span className="text-terminal-muted">{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mistakes Identified */}
                  {reflection.mistakes_identified.length > 0 && (
                    <div>
                      <h3 className="text-lg font-mono font-bold text-terminal-warning mb-3 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2" />
                        Mistakes Identified
                      </h3>
                      <div className="space-y-3">
                        {reflection.mistakes_identified.map((mistake, index) => (
                          <div key={index} className="border border-terminal-warning border-opacity-30 rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono font-bold text-terminal-warning">
                                {mistake.category}
                              </span>
                              <span className="text-xs text-terminal-muted">
                                Frequency: {mistake.frequency}, Impact: {formatCurrency(mistake.impact_pnl)}
                              </span>
                            </div>
                            <div className="text-sm font-mono text-terminal-muted mb-2">
                              {mistake.description}
                            </div>
                            {mistake.examples.length > 0 && (
                              <div className="text-xs font-mono text-terminal-muted">
                                Examples: {mistake.examples.slice(0, 2).join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {reflection.recommended_adjustments.length > 0 && (
                    <div>
                      <h3 className="text-lg font-mono font-bold text-terminal-primary mb-3 flex items-center">
                        <Target className="w-5 h-5 mr-2" />
                        Recommendations
                      </h3>
                      <div className="space-y-3">
                        {reflection.recommended_adjustments.map((rec, index) => (
                          <div key={index} className="border border-terminal-primary border-opacity-30 rounded p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono font-bold text-terminal-primary">
                                {rec.area}
                              </span>
                              <span className={`text-xs font-mono ${getPriorityColor(rec.priority)}`}>
                                {rec.priority} PRIORITY
                              </span>
                            </div>
                            <div className="text-sm font-mono text-terminal-muted mb-2">
                              {rec.reasoning}
                            </div>
                            <div className="text-xs font-mono text-terminal-muted">
                              Current: {rec.current_value} → Recommended: {rec.recommended_value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Focus Areas */}
                  {reflection.future_focus_areas.length > 0 && (
                    <div>
                      <h3 className="text-sm font-mono font-bold text-terminal-secondary mb-2">
                        Future Focus Areas:
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {reflection.future_focus_areas.map((area, index) => (
                          <span 
                            key={index}
                            className="px-2 py-1 bg-terminal-border text-xs font-mono rounded"
                          >
                            {area}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-dot red"></div>
                <div className="terminal-dot yellow"></div>
                <div className="terminal-dot green"></div>
                <div className="ml-4 text-terminal-muted text-sm font-mono">No Reflections</div>
              </div>
              <div className="terminal-content">
                <div className="text-center text-terminal-muted py-12">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <div className="text-lg mb-2">No AI reflections available</div>
                  <div className="text-sm mb-4">Generate your first reflection to see system insights</div>
                  <button
                    onClick={handleGenerateReflection}
                    className="btn-terminal"
                  >
                    Generate Reflection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}