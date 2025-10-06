/**
 * Elysian Trading System - Logger Utility
 * Winston-based logging with multiple transports
 */

import winston from 'winston'
import * as path from 'path'
import * as fs from 'fs'

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`

    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`
    }

    return msg
  })
)

// JSON format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'elysian-trading' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        consoleFormat
      )
    }),

    // File output - all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'elysian.log'),
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),

    // File output - errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),

    // File output - trading activity
    new winston.transports.File({
      filename: path.join(logsDir, 'trading.log'),
      format: fileFormat,
      maxsize: 20971520, // 20MB
      maxFiles: 10,
      // Filter for trading-related logs
      filter: (info) => {
        return info.message.includes('trade') || 
               info.message.includes('signal') || 
               info.message.includes('portfolio') ||
               info.message.includes('cycle')
      }
    })
  ],

  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat
    })
  ],

  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat
    })
  ]
})

// Add performance monitoring
export const performanceLogger = {
  time: (label: string) => {
    console.time(label)
    logger.debug(`Timer started: ${label}`)
  },

  timeEnd: (label: string) => {
    console.timeEnd(label)
    logger.debug(`Timer ended: ${label}`)
  },

  logMemoryUsage: () => {
    const usage = process.memoryUsage()
    logger.info('Memory usage:', {
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`
    })
  }
}

// Export default logger
export default logger
