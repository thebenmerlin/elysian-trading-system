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

  //Newly added properties
  private errorCount: number = 0;
  private consecutiveErrors: number = 0;
  private maxErrors: number = 5;
  private maxConsecutiveErrors: number = 3;
  private lastSuccessfulRun: Date = new Date();
  private retryAttempts: Map<string, number> = new Map();
  private systemHealthScore: number = 1.0;
  private emergencyMode: boolean = false;



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

  private async handleCycleError(error: any, phase: string): Promise<void> {
    this.errorCount++;
    this.consecutiveErrors++;
    
    logger.error(`🚨 Error in ${phase} (${this.consecutiveErrors}/${this.maxConsecutiveErrors} consecutive):`, {
      error: error.message,
      phase,
      errorCount: this.errorCount,
      consecutiveErrors: this.consecutiveErrors,
      systemHealth: this.systemHealthScore
    });

    // Update system health score
    this.systemHealthScore = Math.max(0.1, this.systemHealthScore - 0.1);

    // Emergency shutdown conditions
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      logger.error('🚨 MAXIMUM CONSECUTIVE ERRORS REACHED - ENTERING EMERGENCY MODE');
      await this.enterEmergencyMode();
      return;
    }

    if (this.errorCount >= this.maxErrors) {
      logger.error('🚨 MAXIMUM TOTAL ERRORS REACHED - STOPPING RUNNER');
      await this.emergencyShutdown();
      return;
    }

    // Adaptive retry logic
    const retryDelay = this.calculateRetryDelay(phase);
    logger.info(`⏱ Waiting ${retryDelay/1000} seconds before retry...`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  private calculateRetryDelay(phase: string): number {
    const baseDelay = 30000; // 30 seconds
    const phaseMultipliers: { [key: string]: number } = {
      'DATA_INGESTION': 1.0,
      'FEATURE_COMPUTATION': 1.2,
      'SIGNAL_GENERATION': 1.5,
      'AI_ANALYSIS': 2.0,
      'TRADE_EXECUTION': 0.5, // Faster retry for trading
      'PORTFOLIO_UPDATE': 0.8
    };
    
    const multiplier = phaseMultipliers[phase] || 1.0;
    const errorMultiplier = Math.min(this.consecutiveErrors, 5);
    
    return Math.min(baseDelay * multiplier * errorMultiplier, 300000); // Max 5 minutes
  }

  private async enterEmergencyMode(): Promise<void> {
    this.emergencyMode = true;
    logger.error('🚨 ENTERING EMERGENCY MODE - SYSTEM WILL ATTEMPT SELF-RECOVERY');

    try {
      // Reduce system load
      this.config.run_interval_minutes = Math.max(this.config.run_interval_minutes * 2, 60);
      this.config.tickers = this.config.tickers.slice(0, 2); // Reduce to 2 symbols

      // Health check sequence
      await this.performSystemDiagnostics();

      // Wait longer before retry
      const recoveryWait = 10 * 60 * 1000; // 10 minutes
      logger.info(`🕐 Emergency recovery wait: ${recoveryWait/60000} minutes`);
      await new Promise(resolve => setTimeout(resolve, recoveryWait));

      // Attempt gradual recovery
      await this.attemptGradualRecovery();

    } catch (recoveryError) {
      logger.error('🚨 Emergency recovery failed:', recoveryError);
      await this.emergencyShutdown();
    }
  }

  private async emergencyShutdown(): Promise<void> {
    logger.error('🚨 EMERGENCY SHUTDOWN INITIATED');
    
    try {
      // Save current state
      await this.saveEmergencyState();
      
      // Stop all operations
      this.isRunning = false;
      if (this.cronJob) {
        this.cronJob.destroy();
        this.cronJob = null;
      }
      
      // Mark current cycle as failed
      if (this.currentCycle) {
        this.currentCycle.status = 'FAILED';
        this.currentCycle.phase = 'ERROR';
        this.currentCycle.errors.push('Emergency shutdown triggered');
        await this.storeCycleResults(this.currentCycle);
      }

      logger.error('🛑 Runner stopped due to excessive errors. Manual intervention required.');
      
    } catch (shutdownError) {
      logger.error('🚨 Error during emergency shutdown:', shutdownError);
    }
  }

  private async performSystemDiagnostics(): Promise<void> {
    logger.info('🔍 Performing system diagnostics...');

    const diagnostics = {
      database: false,
      dataSource: false,
      signalEngine: false,
      portfolioManager: false
    };

    try {
      // Database check
      diagnostics.database = await DatabaseManager.healthCheck();
      logger.info(`📊 Database: ${diagnostics.database ? '✅ OK' : '❌ FAILED'}`);

      // Data source check
      const dataHealth = await dataIngestor.healthCheck();
      diagnostics.dataSource = dataHealth.status === 'healthy';
      logger.info(`📡 Data source: ${diagnostics.dataSource ? '✅ OK' : '❌ FAILED'}`);

      // Signal engine check (try to generate signals for one symbol)
      try {
        const testFeatures = await featuresEngine.computeFeatures(['AAPL']);
        const testSignals = await signalEngine.generateSignals(testFeatures);
        diagnostics.signalEngine = testSignals.length >= 0; // Even 0 signals is OK
        logger.info(`🎯 Signal engine: ${diagnostics.signalEngine ? '✅ OK' : '❌ FAILED'}`);
      } catch (signalError) {
        diagnostics.signalEngine = false;
        logger.error('❌ Signal engine diagnostic failed:', signalError);
      }

      // Portfolio manager check
      try {
        const snapshot = await portfolioManager.getLatestPortfolioSnapshot();
        diagnostics.portfolioManager = !!snapshot;
        logger.info(`💼 Portfolio manager: ${diagnostics.portfolioManager ? '✅ OK' : '❌ FAILED'}`);
      } catch (portfolioError) {
        diagnostics.portfolioManager = false;
        logger.error('❌ Portfolio manager diagnostic failed:', portfolioError);
      }

      // Calculate overall health score
      const healthComponents = Object.values(diagnostics);
      const healthyCount = healthComponents.filter(Boolean).length;
      this.systemHealthScore = healthyCount / healthComponents.length;
      
      logger.info(`🏥 System health score: ${(this.systemHealthScore * 100).toFixed(1)}%`);

    } catch (diagnosticError) {
      logger.error('🚨 System diagnostics failed:', diagnosticError);
      this.systemHealthScore = 0.1;
    }
  }

  private async attemptGradualRecovery(): Promise<void> {
    logger.info('🔄 Attempting gradual recovery...');

    // Reset some error counters for recovery attempt
    this.consecutiveErrors = Math.floor(this.consecutiveErrors / 2);
    
    // Start with minimal configuration
    const recoveryConfig = {
      ...this.config,
      run_interval_minutes: 60, // 1 hour intervals
      tickers: ['AAPL'], // Single, reliable symbol
      enable_ai_analysis: false, // Disable AI temporarily
      enable_trading: false // No trading during recovery
    };

    logger.info('🧪 Testing recovery with minimal configuration...');

    try {
      // Test a single cycle with recovery config
      const originalConfig = this.config;
      this.config = recoveryConfig;

      await this.runMinimalCycle();

      // If successful, gradually restore functionality
      logger.info('✅ Recovery test successful - restoring functionality');
      
      // Restore original config gradually
      this.config = {
        ...originalConfig,
        run_interval_minutes: Math.max(originalConfig.run_interval_minutes, 30),
        tickers: originalConfig.tickers.slice(0, 3), // Start with 3 symbols
        enable_ai_analysis: this.systemHealthScore > 0.7,
        enable_trading: false // Keep trading disabled until fully recovered
      };

      this.emergencyMode = false;
      this.consecutiveErrors = 0;
      this.systemHealthScore = Math.min(this.systemHealthScore + 0.3, 1.0);

      logger.info('🎉 Gradual recovery completed successfully');

    } catch (recoveryError) {
      logger.error('❌ Gradual recovery failed:', recoveryError);
      throw recoveryError;
    }
  }

  private async runMinimalCycle(): Promise<void> {
    logger.info('🧪 Running minimal recovery cycle...');

    try {
      // Just test data ingestion and basic processing
      const marketData = await dataIngestor.fetchMarketData(['AAPL']);
      if (marketData.length === 0) {
        throw new Error('No market data received');
      }

      const features = await featuresEngine.computeFeatures(['AAPL']);
      if (features.length === 0) {
        throw new Error('No features computed');
      }

      logger.info('✅ Minimal cycle completed successfully');

    } catch (error) {
      logger.error('❌ Minimal cycle failed:', error);
      throw error;
    }
  }

  private async saveEmergencyState(): Promise<void> {
    try {
      const emergencyState = {
        timestamp: new Date().toISOString(),
        errorCount: this.errorCount,
        consecutiveErrors: this.consecutiveErrors,
        lastSuccessfulRun: this.lastSuccessfulRun.toISOString(),
        systemHealthScore: this.systemHealthScore,
        currentCycle: this.currentCycle,
        config: this.config
      };

      // Save to database or file system
      await DatabaseManager.query(
        `INSERT INTO runner_cycles (id, timestamp, phase, status, errors, results) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `emergency_${Date.now()}`,
          new Date(),
          'EMERGENCY_SHUTDOWN',
          'FAILED',
          JSON.stringify(['Emergency shutdown due to excessive errors']),
          JSON.stringify(emergencyState)
        ]
      );

      logger.info('💾 Emergency state saved successfully');

    } catch (saveError) {
      logger.error('❌ Failed to save emergency state:', saveError);
    }
  }

  private resetErrorCounters(): void {
    this.errorCount = Math.floor(this.errorCount / 2); // Reduce but don't reset completely
    this.consecutiveErrors = 0;
    this.lastSuccessfulRun = new Date();
    this.systemHealthScore = Math.min(this.systemHealthScore + 0.1, 1.0);
    this.emergencyMode = false;

    logger.info('✅ Error counters reset after successful cycle', {
      errorCount: this.errorCount,
      systemHealth: this.systemHealthScore
    });
  }


  async runSingleCycle(): Promise<RunCycle> {
    if (this.currentCycle && this.currentCycle.status === 'RUNNING') {
      throw new Error('Another trading cycle is currently running');
    }

    // Check daily run limits
    this.checkDailyLimits();

    // Emergency mode check
    if (this.emergencyMode) {
      throw new Error('System is in emergency mode - manual intervention required');
    }

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
        run_count: this.runCount + 1,
        system_health: this.systemHealthScore,
        emergency_mode: this.emergencyMode
      });

      // Phase 1: Data Ingestion (with error recovery)
      try {
        await this.runDataIngestionPhase();
      } catch (error) {
        await this.handleCycleError(error, 'DATA_INGESTION');
        // Try once more with fallback
        logger.info('🔄 Retrying data ingestion with fallback methods...');
        await this.runDataIngestionPhase();
      }

      // Phase 2: Feature Computation (with error recovery)
      try {
        await this.runFeatureComputationPhase();
      } catch (error) {
        await this.handleCycleError(error, 'FEATURE_COMPUTATION');
        throw error; // This is critical, can't continue without features
      }

      // Phase 3: Signal Generation (with error recovery)
      try {
        await this.runSignalGenerationPhase();
      } catch (error) {
        await this.handleCycleError(error, 'SIGNAL_GENERATION');
        throw error; // This is critical, can't continue without signals
      }

      // Phase 4: AI Analysis (optional, with error recovery)
      if (this.config.enable_ai_analysis && this.systemHealthScore > 0.5) {
        try {
          await this.runAIAnalysisPhase();
        } catch (error) {
          logger.warn('⚠️ AI analysis failed, continuing without it:', error);
          this.currentCycle!.errors.push(`AI analysis failed: ${error.message}`);
        }
      }

      // Phase 5: Trade Execution (optional, with error recovery)
      if (this.config.enable_trading && this.systemHealthScore > 0.7) {
        try {
          await this.runTradeExecutionPhase();
        } catch (error) {
          logger.warn('⚠️ Trade execution failed, continuing:', error);
          this.currentCycle!.errors.push(`Trade execution failed: ${error.message}`);
        }
      } else {
        logger.info('📝 Paper trading mode or low system health - no actual trades executed');
      }

      // Phase 6: Portfolio Update (with error recovery)
      try {
        await this.runPortfolioUpdatePhase();
      } catch (error) {
        logger.warn('⚠️ Portfolio update failed:', error);
        this.currentCycle!.errors.push(`Portfolio update failed: ${error.message}`);
      }

      // Phase 7: Reflection (periodic, with error recovery)
      if (this.shouldRunReflection()) {
        try {
          await this.runReflectionPhase();
        } catch (error) {
          logger.warn('⚠️ Reflection phase failed:', error);
        }
      }

      // Phase 8: Reporting (periodic, with error recovery)
      if (this.shouldRunReport()) {
        try {
          await this.runReportingPhase();
        } catch (error) {
          logger.warn('⚠️ Reporting phase failed:', error);
        }
      }

      // Cycle completed successfully
      this.currentCycle.status = 'SUCCESS';
      this.currentCycle.phase = 'COMPLETED';
      this.currentCycle.metrics.total_cycle_time_ms = Date.now() - startTime;
      
      this.runCount++;
      this.dailyRunCount++;

      // Reset error counters on success
      this.resetErrorCounters();

      // Store cycle results
      await this.storeCycleResults(this.currentCycle);

      logger.info(`✅ Trading cycle completed: ${cycleId}`, {
        total_time: this.currentCycle.metrics.total_cycle_time_ms,
        signals_generated: this.currentCycle.signals_generated,
        trades_executed: this.currentCycle.trades_executed,
        portfolio_change: this.currentCycle.results.portfolio_value_change,
        system_health: this.systemHealthScore
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

      // Handle the error (might trigger emergency procedures)
      await this.handleCycleError(error, 'OVERALL_CYCLE');
      
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
    
    // Get latest signals from this cycle
    const recentSignals = await signalEngine.getLatestSignals(
      this.currentCycle!.tickers_processed, 
      10
    );

    // Get current portfolio value
    const portfolioSnapshot = await portfolioManager.getLatestPortfolioSnapshot();
    const portfolioValue = portfolioSnapshot?.total_value || 100000;

    // Execute trades based on signals
    let tradesExecuted = 0;
    for (const signal of recentSignals) {
      if (signal.signal_type !== 'HOLD' && signal.confidence > 0.6) {
        try {
          // Get AI analysis for this signal
          const aiAnalysis = await aiReasoner.analyzeMarket(
            signal.symbol, 
            {}, // market data
            {}, // features 
            signal
          );

          // Execute the trade
          const trade = await executionEngine.evaluateAndExecute(
            signal, 
            aiAnalysis, 
            portfolioValue
          );

          if (trade) {
            tradesExecuted++;
            logger.info(`✅ Executed trade: ${trade.side} ${trade.quantity} ${trade.symbol} @ $${trade.executed_price}`);
          }
        } catch (error) {
          logger.error(`❌ Failed to execute trade for ${signal.symbol}:`, error);
        }
      }
    }

    this.currentCycle!.trades_executed = tradesExecuted;
    this.currentCycle!.metrics.execution_time_ms = Date.now() - startTime;

    logger.info('⚡ Trade execution completed', {
      signals_evaluated: recentSignals.length,
      trades_executed: tradesExecuted,
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
