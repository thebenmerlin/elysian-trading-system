/**
 * Elysian Trading System - Main Runner
 * Orchestrates the complete autonomous trading cycle
 */

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

export interface RunnerConfig {
  tickers: string[];
  run_interval_minutes: number;
  enable_trading: boolean;
  enable_ai_analysis: boolean;
  reflection_frequency: number; // Every N runs
  report_frequency: number; // Every N runs
  max_daily_runs: number;
}

export interface RunCycle {
  id: string;
  timestamp: Date;
  phase: 'STARTING' | 'DATA_INGESTION' | 'FEATURE_COMPUTATION' | 'SIGNAL_GENERATION' |   
    'AI_ANALYSIS' | 'TRADE_EXECUTION' | 'PORTFOLIO_UPDATE' | 'REFLECTION' |   
    'REPORTING' | 'COMPLETED' | 'ERROR';
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  tickers_processed: string[];
  signals_generated: number;
  trades_executed: number;
  errors: string[];
  metrics: {
    data_ingestion_time_ms: number;
    feature_computation_time_ms: number;
    signal_generation_time_ms: number;
    ai_analysis_time_ms: number;
    execution_time_ms: number;
    total_cycle_time_ms: number;
  };
  results: {
    portfolio_value_change: number;
    new_positions: number;
    closed_positions: number;
    daily_pnl: number;
  };
}

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

  async stopRunner(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading runner is not running');
      return;
    }

    this.isRunning = false;

    // Stop cron job
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }

    // Wait for current cycle to complete if running
    if (this.currentCycle && this.currentCycle.status === 'RUNNING') {
      logger.info('Waiting for current trading cycle to complete...');
      // Give it up to 2 minutes to complete
      let waitTime = 0;
      while (this.currentCycle?.status === 'RUNNING' && waitTime < 120000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
      }
    }

    logger.info('🛑 Elysian Trading Runner stopped');
  }

  async runSingleCycle(): Promise<RunCycle> {
    if (this.currentCycle && this.currentCycle.status === 'RUNNING') {
      throw new Error('Another trading cycle is currently running');
    }

    // Check daily run limits
    this.checkDailyLimits();

    const cycleId = `cycle_${Date.now()}`;
    this.currentCycle = {
      id: cycleId,
      timestamp: new Date(),
      phase: 'STARTING',
      status: 'RUNNING',
      tickers_processed: [],
      signals_generated: 0,
      trades_executed: 0,
      errors: [],
      metrics: {
        data_ingestion_time_ms: 0,
        feature_computation_time_ms: 0,
        signal_generation_time_ms: 0,
        ai_analysis_time_ms: 0,
        execution_time_ms: 0,
        total_cycle_time_ms: 0
      },
      results: {
        portfolio_value_change: 0,
        new_positions: 0,
        closed_positions: 0,
        daily_pnl: 0
      }
    };

    const startTime = Date.now();

    try {
      logger.info(`🔄 Starting trading cycle: ${cycleId}`, {
        tickers: this.config.tickers,
        run_count: this.runCount + 1
      });

      // Phase 1: Data Ingestion
      await this.runDataIngestionPhase();

      // Phase 2: Feature Computation
      await this.runFeatureComputationPhase();

      // Phase 3: Signal Generation
      await this.runSignalGenerationPhase();

      // Phase 4: AI Analysis (if enabled)
      if (this.config.enable_ai_analysis) {
        await this.runAIAnalysisPhase();
      }

      // Phase 5: Trade Execution (if enabled)
      if (this.config.enable_trading) {
        await this.runTradeExecutionPhase();
      } else {
        logger.info('📝 Paper trading mode - no actual trades executed');
      }

      // Phase 6: Portfolio Update
      await this.runPortfolioUpdatePhase();

      // Phase 7: Reflection (periodic)
      if (this.shouldRunReflection()) {
        await this.runReflectionPhase();
      }

      // Phase 8: Reporting (periodic)
      if (this.shouldRunReport()) {
        await this.runReportingPhase();
      }

      // Cycle completed successfully
      this.currentCycle.status = 'SUCCESS';
      this.currentCycle.phase = 'COMPLETED';
      this.currentCycle.metrics.total_cycle_time_ms = Date.now() - startTime;

      this.runCount++;
      this.dailyRunCount++;

      // Store cycle results
      await this.storeCycleResults(this.currentCycle);

      logger.info(`✅ Trading cycle completed: ${cycleId}`, {
        total_time: this.currentCycle.metrics.total_cycle_time_ms,
        signals_generated: this.currentCycle.signals_generated,
        trades_executed: this.currentCycle.trades_executed,
        portfolio_change: this.currentCycle.results.portfolio_value_change
      });

      return this.currentCycle;

    } catch (error) {
      logger.error(`❌ Trading cycle failed: ${cycleId}`, error);
      
      if (this.currentCycle) {
        this.currentCycle.status = 'FAILED';
        this.currentCycle.phase = 'ERROR';
        this.currentCycle.errors.push(error instanceof Error ? error.message : String(error));
        this.currentCycle.metrics.total_cycle_time_ms = Date.now() - startTime;
        await this.storeCycleResults(this.currentCycle);
      }
      
      throw error;
    }
  }

  getRunnerStatus(): {
    is_running: boolean;
    run_count: number;
    daily_run_count: number;
    current_cycle: RunCycle | null;
    config: RunnerConfig;
  } {
    return {
      is_running: this.isRunning,
      run_count: this.runCount,
      daily_run_count: this.dailyRunCount,
      current_cycle: this.currentCycle,
      config: this.config
    };
  }

  private async validateConfiguration(): Promise<void> {
    // Validate tickers
    if (!this.config.tickers || this.config.tickers.length === 0) {
      throw new Error('No tickers configured for trading');
    }

    // Validate intervals
    if (this.config.run_interval_minutes < 1 || this.config.run_interval_minutes > 1440) {
      throw new Error('Run interval must be between 1 and 1440 minutes');
    }

    // Check database connectivity
    const dbHealthy = await DatabaseManager.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection not healthy');
    }

    logger.info('Configuration validated successfully');
  }

  private async initializeRunner(): Promise<void> {
    logger.info('Initializing trading runner...');
    
    // Check data source health
    const dataHealth = await dataIngestor.healthCheck();
    logger.info('Data sources health check:', dataHealth);

    // Check AI reasoner if enabled
    if (this.config.enable_ai_analysis) {
      const aiHealthy = await aiReasoner.healthCheck();
      logger.info(`AI reasoner health: ${aiHealthy ? 'OK' : 'DEGRADED'}`);
    }

    logger.info('Trading runner initialized');
  }

  private scheduleRuns(): void {
    const cronPattern = `*/${this.config.run_interval_minutes} * * * *`;
    
    this.cronJob = cron.schedule(cronPattern, async () => {
      if (this.isRunning && (!this.currentCycle || this.currentCycle.status !== 'RUNNING')) {
        try {
          await this.runSingleCycle();
        } catch (error) {
          logger.error('Scheduled trading cycle failed:', error);
        }
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York' // Market timezone
    });

    logger.info(`📅 Trading cycles scheduled every ${this.config.run_interval_minutes} minutes`);
  }

  private checkDailyLimits(): void {
    const now = new Date();
    
    // Reset daily counter if new day
    if (now.toDateString() !== this.lastRunDate.toDateString()) {
      this.dailyRunCount = 0;
      this.lastRunDate = now;
      logger.info('Daily run counter reset');
    }

    // Check daily limits
    if (this.dailyRunCount >= this.config.max_daily_runs) {
      throw new Error(`Daily run limit exceeded: ${this.config.max_daily_runs}`);
    }
  }

  private shouldRunReflection(): boolean {
    return this.runCount > 0 && this.runCount % this.config.reflection_frequency === 0;
  }

  private shouldRunReport(): boolean {
    return this.runCount > 0 && this.runCount % this.config.report_frequency === 0;
  }

  // Mock implementation of trading phases
  private async runDataIngestionPhase(): Promise<void> {
    this.currentCycle!.phase = 'DATA_INGESTION';
    const startTime = Date.now();
    
    try {
      logger.info('📥 Data ingestion phase started');
      const marketData = await dataIngestor.fetchMarketData(this.config.tickers);
      this.currentCycle!.tickers_processed = [...new Set(marketData.map(d => d.symbol))];
      this.currentCycle!.metrics.data_ingestion_time_ms = Date.now() - startTime;
      
      logger.info('📥 Data ingestion completed', {
        tickers_processed: this.currentCycle!.tickers_processed.length,
        data_points: marketData.length,
        time_ms: this.currentCycle!.metrics.data_ingestion_time_ms
      });
    } catch (error) {
      this.currentCycle!.errors.push(`Data ingestion failed: ${error}`);
      throw error;
    }
  }

  private async runFeatureComputationPhase(): Promise<void> {
    this.currentCycle!.phase = 'FEATURE_COMPUTATION';
    const startTime = Date.now();
    
    try {
      logger.info('🔧 Feature computation phase started');
      const features = await featuresEngine.computeFeatures(this.currentCycle!.tickers_processed);
      this.currentCycle!.metrics.feature_computation_time_ms = Date.now() - startTime;
      
      logger.info('🔧 Feature computation completed', {
        features_computed: features.length,
        time_ms: this.currentCycle!.metrics.feature_computation_time_ms
      });
    } catch (error) {
      this.currentCycle!.errors.push(`Feature computation failed: ${error}`);
      throw error;
    }
  }

  private async runSignalGenerationPhase(): Promise<void> {
    this.currentCycle!.phase = 'SIGNAL_GENERATION';
    const startTime = Date.now();
    
    try {
      logger.info('📊 Signal generation phase started');
      const features = await featuresEngine.getLatestFeatures(this.currentCycle!.tickers_processed);
      const signals = await signalEngine.generateSignals(features);
      this.currentCycle!.signals_generated = signals.length;
      this.currentCycle!.metrics.signal_generation_time_ms = Date.now() - startTime;
      
      logger.info('📊 Signal generation completed', {
        signals_generated: signals.length,
        time_ms: this.currentCycle!.metrics.signal_generation_time_ms
      });
    } catch (error) {
      this.currentCycle!.errors.push(`Signal generation failed: ${error}`);
      throw error;
    }
  }

  private async runAIAnalysisPhase(): Promise<void> {
    this.currentCycle!.phase = 'AI_ANALYSIS';
    const startTime = Date.now();
    
    try {
      logger.info('🤖 AI analysis phase started');
      this.currentCycle!.metrics.ai_analysis_time_ms = Date.now() - startTime;
      
      logger.info('🤖 AI analysis completed', {
        time_ms: this.currentCycle!.metrics.ai_analysis_time_ms
      });
    } catch (error) {
      this.currentCycle!.errors.push(`AI analysis failed: ${error}`);
      throw error;
    }
  }

  private async runTradeExecutionPhase(): Promise<void> {
    this.currentCycle!.phase = 'TRADE_EXECUTION';
    const startTime = Date.now();
    
    try {
      logger.info('⚡ Trade execution phase started');
      this.currentCycle!.trades_executed = 0;
      this.currentCycle!.metrics.execution_time_ms = Date.now() - startTime;
      
      logger.info('⚡ Trade execution completed', {
        trades_executed: this.currentCycle!.trades_executed,
        time_ms: this.currentCycle!.metrics.execution_time_ms
      });
    } catch (error) {
      this.currentCycle!.errors.push(`Trade execution failed: ${error}`);
      throw error;
    }
  }

  private async runPortfolioUpdatePhase(): Promise<void> {
    this.currentCycle!.phase = 'PORTFOLIO_UPDATE';
    
    try {
      logger.info('💼 Portfolio update phase started');
      const currentSnapshot = await portfolioManager.createPortfolioSnapshot();
      this.currentCycle!.results.portfolio_value_change = 0;
      this.currentCycle!.results.daily_pnl = currentSnapshot.daily_pnl;
      
      logger.info('💼 Portfolio update completed', {
        current_value: currentSnapshot.total_value,
        daily_pnl: currentSnapshot.daily_pnl
      });
    } catch (error) {
      this.currentCycle!.errors.push(`Portfolio update failed: ${error}`);
      throw error;
    }
  }

  private async runReflectionPhase(): Promise<void> {
    this.currentCycle!.phase = 'REFLECTION';
    
    try {
      logger.info('🤔 Reflection phase started');
      const reflection = await reflectionEngine.generateReflection(7);
      logger.info('🤔 Reflection completed');
    } catch (error) {
      logger.warn('Reflection phase failed:', error);
      this.currentCycle!.errors.push(`Reflection failed: ${error}`);
    }
  }

  private async runReportingPhase(): Promise<void> {
    this.currentCycle!.phase = 'REPORTING';
    
    try {
      logger.info('📊 Reporting phase started');
      const report = await reportsGenerator.generatePerformanceReport(30);
      logger.info('📊 Reporting completed');
    } catch (error) {
      logger.warn('Reporting phase failed:', error);
      this.currentCycle!.errors.push(`Reporting failed: ${error}`);
    }
  }

  private async storeCycleResults(cycle: RunCycle): Promise<void> {
    try {
      const query = `
        INSERT INTO runner_cycles (
          id, timestamp, phase, status, tickers_processed, signals_generated,
          trades_executed, errors, metrics, results
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          phase = EXCLUDED.phase,
          status = EXCLUDED.status,
          signals_generated = EXCLUDED.signals_generated,
          trades_executed = EXCLUDED.trades_executed,
          errors = EXCLUDED.errors,
          metrics = EXCLUDED.metrics,
          results = EXCLUDED.results
      `;
      
      await DatabaseManager.query(query, [
        cycle.id,
        cycle.timestamp,
        cycle.phase,
        cycle.status,
        JSON.stringify(cycle.tickers_processed),
        cycle.signals_generated,
        cycle.trades_executed,
        JSON.stringify(cycle.errors),
        JSON.stringify(cycle.metrics),
        JSON.stringify(cycle.results)
      ]);
    } catch (error) {
      logger.error('Failed to store cycle results:', error);
    }
  }
}

export const tradingRunner = new TradingRunner();
