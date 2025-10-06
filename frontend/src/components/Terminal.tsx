/**
 * Elysian Trading System - Terminal Component
 * Animated terminal-style display with typewriter effect
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TerminalLine {
  id: string
  text: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'command'
  timestamp?: Date
}

interface TerminalProps {
  lines: TerminalLine[]
  maxLines?: number
  typewriterSpeed?: number
  showTimestamp?: boolean
  showCursor?: boolean
  className?: string
}

export default function Terminal({
  lines,
  maxLines = 20,
  typewriterSpeed = 50,
  showTimestamp = true,
  showCursor = true,
  className = ''
}: TerminalProps) {
  const [displayedLines, setDisplayedLines] = useState<TerminalLine[]>([])
  const [currentLineIndex, setCurrentLineIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [currentCharIndex, setCurrentCharIndex] = useState(0)

  // Keep only the most recent lines
  const visibleLines = displayedLines.slice(-maxLines)

  useEffect(() => {
    if (currentLineIndex < lines.length) {
      const currentLine = lines[currentLineIndex]

      if (currentCharIndex < currentLine.text.length) {
        const timer = setTimeout(() => {
          setCurrentText(prev => prev + currentLine.text[currentCharIndex])
          setCurrentCharIndex(prev => prev + 1)
        }, typewriterSpeed)

        return () => clearTimeout(timer)
      } else {
        // Line completed, add to displayed lines
        const completedLine: TerminalLine = {
          ...currentLine,
          text: currentText,
          timestamp: currentLine.timestamp || new Date()
        }

        setDisplayedLines(prev => [...prev, completedLine])
        setCurrentLineIndex(prev => prev + 1)
        setCurrentText('')
        setCurrentCharIndex(0)
      }
    }
  }, [currentLineIndex, currentCharIndex, currentText, lines, typewriterSpeed])

  const getLineColor = (type: string = 'info'): string => {
    switch (type) {
      case 'success':
        return 'text-terminal-primary'
      case 'warning':
        return 'text-terminal-warning'
      case 'error':
        return 'text-terminal-error'
      case 'command':
        return 'text-terminal-secondary'
      default:
        return 'text-terminal-primary'
    }
  }

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className={`terminal-window ${className}`}>
      {/* Terminal header */}
      <div className="terminal-header">
        <div className="terminal-dot red"></div>
        <div className="terminal-dot yellow"></div>
        <div className="terminal-dot green"></div>
        <div className="ml-4 text-terminal-muted text-sm font-mono">
          Elysian Trading Terminal
        </div>
      </div>

      {/* Terminal content */}
      <div className="terminal-content min-h-[400px] max-h-[600px] overflow-y-auto">
        <AnimatePresence>
          {visibleLines.map((line, index) => (
            <motion.div
              key={line.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start space-x-2 mb-1 ${getLineColor(line.type)}`}
            >
              {showTimestamp && (
                <span className="text-terminal-muted text-xs shrink-0">
                  [{formatTimestamp(line.timestamp!)}]
                </span>
              )}
              <span className="font-mono text-sm leading-relaxed break-all">
                {line.type === 'command' && '$ '}
                {line.text}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Current typing line */}
        {currentLineIndex < lines.length && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex items-start space-x-2 mb-1 ${getLineColor(lines[currentLineIndex]?.type)}`}
          >
            {showTimestamp && (
              <span className="text-terminal-muted text-xs shrink-0">
                [{formatTimestamp(new Date())}]
              </span>
            )}
            <span className="font-mono text-sm leading-relaxed break-all">
              {lines[currentLineIndex]?.type === 'command' && '$ '}
              {currentText}
              {showCursor && (
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-2 h-5 bg-terminal-primary ml-1"
                />
              )}
            </span>
          </motion.div>
        )}

        {/* Empty state */}
        {lines.length === 0 && (
          <div className="text-terminal-muted text-center py-8">
            <div className="text-lg mb-2">⚡ Elysian Trading System</div>
            <div className="text-sm">Autonomous AI-powered trading platform</div>
            <div className="text-xs mt-4 opacity-60">Waiting for system initialization...</div>
          </div>
        )}
      </div>
    </div>
  )
}

// Hook for managing terminal lines
export function useTerminalLines(initialLines: TerminalLine[] = []) {
  const [lines, setLines] = useState<TerminalLine[]>(initialLines)

  const addLine = (text: string, type: TerminalLine['type'] = 'info') => {
    const newLine: TerminalLine = {
      id: `line_${Date.now()}_${Math.random()}`,
      text,
      type,
      timestamp: new Date()
    }
    setLines(prev => [...prev, newLine])
  }

  const clearLines = () => setLines([])

  const addCommand = (command: string) => addLine(command, 'command')
  const addSuccess = (message: string) => addLine(message, 'success')
  const addWarning = (message: string) => addLine(message, 'warning')
  const addError = (message: string) => addLine(message, 'error')

  return {
    lines,
    setLines,
    addLine,
    clearLines,
    addCommand,
    addSuccess,
    addWarning,
    addError
  }
}
