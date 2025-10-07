/// <reference types="node" />

/**
 * Elysian Trading System - Main Runner
 * Orchestrates the complete autonomous trading cycle
 */

import * as process from 'process';
import { logger } from '../utils/logger';
import { DatabaseManager } from '../utils/database';
import { dataIngestor } from '../data_ingestor';
import { featuresEngine } from '../features';
import { signalEngine } from '../signal_engine';
import { aiReasoner } from '../ai_reasoner';
import { executionEngine } from '../execution';
import { portfolioManager } from '../portfolio';
import { reflectionEngine } from '../reflection';
import { reportsGenerator } from '../reports';
import * as cron from 'node-cron';

// Keep all the existing interfaces and class implementation exactly as is...
// Just replace the constructor to use explicit process references:

export class TradingRunner {
  private config: RunnerConfig;
  private isRunning: boolean = false;
  private currentCycle: RunCycle | null = null;
  private runCount: number = 0;
  private dailyRunCount: number = 0;
  private lastRunDate: Date = new Date();
  private cronJob: any = null;

  constructor(config?: Partial<RunnerConfig>) {
    this.config = {
      tickers: process.env.RUNNER_TICKERS?.split(',') || ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'],
      run_interval_minutes: parseInt(process.env.RUN_INTERVAL_MINUTES || '15'),
      enable_trading: process.env.ELYSIAN_LIVE === 'true',
      enable_ai_analysis: process.env.ENABLE_AI_ANALYSIS !== 'false',
      reflection_frequency: parseInt(process.env.RUN_REFLECTION_EVERY || '12'),
      report_frequency: parseInt(process.env.RUN_REPORT_EVERY || '24'),
      max_daily_runs: parseInt(process.env.MAX_DAILY_RUNS || '96'),
      ...config
    };
  }

  // Keep all other methods exactly as they are...
  // Just update the auto-start check to use explicit process:
  async startRunner(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Trading runner is already running');
      return;
    }

    try {
      await this.validateConfiguration();
      await this.initializeRunner();
      
      this.isRunning = true;
      
      logger.info('🚀 Elysian Trading Runner started', {
        tickers: this.config.tickers,
        interval_minutes: this.config.run_interval_minutes,
        trading_enabled: this.config.enable_trading,
        ai_enabled: this.config.enable_ai_analysis
      });

      this.scheduleRuns();

      if (process.env.AUTO_START_RUNNER === 'true') {
        setTimeout(() => this.runSingleCycle(), 5000);
      }
    } catch (error) {
      logger.error('Failed to start trading runner:', error);
      throw error;
    }
  }

  // Keep the rest of the file exactly as is...
}

// Keep the existing export
export const tradingRunner = new TradingRunner();
