/**
 * Elysian Trading System - Environment Variables Validation
 * Validates required environment variables on startup
 */

import { logger } from './logger'

interface EnvConfig {
  required: string[]
  optional: string[]
  defaults: Record<string, string>
}

const envConfig: EnvConfig = {
  required: [
    'DATABASE_URL',
    'ELYSIAN_API_KEY'
  ],
  optional: [
    'NODE_ENV',
    'PORT',
    'RUNNER_TICKERS',
    'ELYSIAN_LIVE',
    'INITIAL_CASH',
    'RUN_INTERVAL_MINUTES',
    'AUTO_START_RUNNER',
    'HF_API_KEY',
    'FRONTEND_URL',
    'MAX_DAILY_RUNS',
    'ENABLE_AI_ANALYSIS',
    'LOG_LEVEL'
  ],
  defaults: {
    NODE_ENV: 'development',
    PORT: '4000',
    RUNNER_TICKERS: 'AAPL,MSFT,GOOGL,NVDA,TSLA',
    ELYSIAN_LIVE: 'false',
    INITIAL_CASH: '100000',
    RUN_INTERVAL_MINUTES: '15',
    AUTO_START_RUNNER: 'false',
    MAX_DAILY_RUNS: '96',
    ENABLE_AI_ANALYSIS: 'true',
    LOG_LEVEL: 'info'
  }
}

export function validateEnvironment(): void {
  logger.info('Validating environment configuration...')
  
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check required environment variables
  for (const varName of envConfig.required) {
    const value = process.env[varName]
    
    if (!value || value.trim() === '') {
      errors.push(`Required environment variable ${varName} is not set`)
    } else {
      // Validate specific formats
      switch (varName) {
        case 'DATABASE_URL':
          if (!value.startsWith('postgres://') && !value.startsWith('postgresql://')) {
            errors.push(`DATABASE_URL must be a valid PostgreSQL connection string`)
          }
          break
        case 'ELYSIAN_API_KEY':
          if (value.length < 8) {
            warnings.push(`ELYSIAN_API_KEY should be at least 8 characters for security`)
          }
          break
      }
    }
  }
  
  // Set defaults for optional variables
  for (const [varName, defaultValue] of Object.entries(envConfig.defaults)) {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue
      logger.info(`Set default value for ${varName}: ${defaultValue}`)
    }
  }
  
  // Validate optional variables that have specific requirements
  validateOptionalVariables(warnings)
  
  // Log configuration summary
  logConfigurationSummary()
  
  // Handle validation results
  if (errors.length > 0) {
    logger.error('Environment validation failed:')
    errors.forEach(error => logger.error(`  - ${error}`))
    logger.error('Please set the required environment variables and restart the application.')
    process.exit(1)
  }
  
  if (warnings.length > 0) {
    logger.warn('Environment validation warnings:')
    warnings.forEach(warning => logger.warn(`  - ${warning}`))
  }
  
  logger.info('Environment validation completed successfully')
}

function validateOptionalVariables(warnings: string[]): void {
  // Validate PORT
  const port = process.env.PORT
  if (port && (isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535)) {
    warnings.push(`PORT must be a valid port number (1-65535), got: ${port}`)
  }
  
  // Validate INITIAL_CASH
  const initialCash = process.env.INITIAL_CASH
  if (initialCash && (isNaN(Number(initialCash)) || Number(initialCash) <= 0)) {
    warnings.push(`INITIAL_CASH must be a positive number, got: ${initialCash}`)
  }
  
  // Validate RUN_INTERVAL_MINUTES
  const interval = process.env.RUN_INTERVAL_MINUTES
  if (interval && (isNaN(Number(interval)) || Number(interval) < 1 || Number(interval) > 1440)) {
    warnings.push(`RUN_INTERVAL_MINUTES must be between 1 and 1440, got: ${interval}`)
  }
  
  // Validate RUNNER_TICKERS
  const tickers = process.env.RUNNER_TICKERS
  if (tickers && !tickers.match(/^[A-Z]{1,5}(,[A-Z]{1,5})*$/)) {
    warnings.push(`RUNNER_TICKERS should be comma-separated stock symbols (e.g., AAPL,MSFT), got: ${tickers}`)
  }
  
  // Validate boolean values
  const booleanVars = ['ELYSIAN_LIVE', 'AUTO_START_RUNNER', 'ENABLE_AI_ANALYSIS']
  for (const varName of booleanVars) {
    const value = process.env[varName]
    if (value && !['true', 'false'].includes(value.toLowerCase())) {
      warnings.push(`${varName} must be 'true' or 'false', got: ${value}`)
    }
  }
}

function logConfigurationSummary(): void {
  logger.info('System Configuration Summary:')
  logger.info(`  Environment: ${process.env.NODE_ENV}`)
  logger.info(`  Port: ${process.env.PORT}`)
  logger.info(`  Live Trading: ${process.env.ELYSIAN_LIVE === 'true' ? 'ENABLED' : 'PAPER MODE'}`)
  logger.info(`  Trading Tickers: ${process.env.RUNNER_TICKERS}`)
  logger.info(`  Initial Cash: $${Number(process.env.INITIAL_CASH).toLocaleString()}`)
  logger.info(`  Run Interval: ${process.env.RUN_INTERVAL_MINUTES} minutes`)
  logger.info(`  AI Analysis: ${process.env.ENABLE_AI_ANALYSIS === 'true' ? 'ENABLED' : 'DISABLED'}`)
  logger.info(`  Auto Start: ${process.env.AUTO_START_RUNNER === 'true' ? 'YES' : 'NO'}`)
  
  // Mask sensitive information
  const dbUrl = process.env.DATABASE_URL
  const maskedDbUrl = dbUrl ? 
    dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@') : 'NOT SET'
  logger.info(`  Database: ${maskedDbUrl}`)
  
  const apiKey = process.env.ELYSIAN_API_KEY
  const maskedApiKey = apiKey ? 
    `${apiKey.substring(0, 4)}${'*'.repeat(Math.max(0, apiKey.length - 8))}${apiKey.substring(apiKey.length - 4)}` : 'NOT SET'
  logger.info(`  API Key: ${maskedApiKey}`)
}

export function getRequiredEnvVars(): string[] {
  return [...envConfig.required]
}

export function getOptionalEnvVars(): string[] {
  return [...envConfig.optional]
}

export function getEnvDefaults(): Record<string, string> {
  return { ...envConfig.defaults }
}
