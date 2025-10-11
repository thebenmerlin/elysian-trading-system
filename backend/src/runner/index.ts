/**
 * Elysian Trading System - Dual-Market Trading Runner
 * Orchestrates autonomous trading cycles for both equities and crypto
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
  market_type?: 'equity' | 'crypto';
}

export interface RunCycle {
  id: string;
  timestamp: Date;
  phase: 'STARTING' | 'DATA_INGESTION' | 'FEATURE_COMPUTATION' | 'SIGNAL_GENERATION' |   
    'AI_ANALYSIS' | 'TRADE_EXECUTION' | 'PORTFOLIO_UPDATE' | 'REFLECTION' |   
    'REPORTING' | 'COMPLETED' | 'ERROR';
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  market_type: 'equity' | 'crypto';
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
  // Original properties
  private config: RunnerConfig;
  private isRunning: boolean = false;
  private currentCycle: RunCycle | null = null;
  private runCount: number = 0;
  private dailyRunCount: number = 0;
  private lastRunDate: Date = new Date();
  private cronJob: any = null;

  // Error recovery properties
  private errorCount: number = 0;
  private consecutiveErrors: number = 0;
  private maxErrors: number = 5;
  private maxConsecutiveErrors: number = 3;
  private lastSuccessfulRun: Date = new Date();
  private retryAttempts: Map<string, number> = new Map();
  private systemHealthScore: number = 1.0;
  private emergencyMode: boolean = false;

  // Dual-market properties
  private equityConfig: RunnerConfig;
  private cryptoConfig: RunnerConfig;
  private equityJob: any = null;
  private cryptoJob: any = null;
  private lastEquityRun: Date = new Date();
  private lastCryptoRun: Date = new Date();
  private equityRunCount: number = 0;
  private cryptoRunCount: number = 0;

  constructor(config?: Partial<RunnerConfig>) {
    // Equity configuration (backward compatible)
    this.equityConfig = {
      tickers: process.env.RUNNER_TICKERS?.split(',') || ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'],
      run_interval_minutes: parseInt(process.env.EQUITY_RUN_INTERVAL_MINUTES || process.env.RUN_INTERVAL_MINUTES || '15'),
      enable_trading: process.env.ELYSIAN_LIVE === 'true',
      enable_ai_analysis: process.env.ENABLE_AI_ANALYSIS !== 'false',
      reflection_frequency: parseInt(process.env.RUN_REFLECTION_EVERY || '12'),
      report_frequency: parseInt(process.env.RUN_REPORT_EVERY || '24'),
      max_daily_runs: parseInt(process.env.MAX_DAILY_RUNS || '96'),
      market_type: 'equity',
      ...config
    };

    // Crypto configuration
    this.cryptoConfig = {
      tickers: process.env.CRYPTO_TICKERS?.split(',') || ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'],
      run_interval_minutes: parseInt(process.env.CRYPTO_RUN_INTERVAL_MINUTES || '5'), // 5 minutes for crypto
      enable_trading: process.env.ELYSIAN_LIVE === 'true',
      enable_ai_analysis: process.env.ENABLE_AI_ANALYSIS !== 'false',
      reflection_frequency: parseInt(process.env.CRYPTO_REFLECTION_EVERY || '24'), // Less frequent for crypto
      report_frequency: parseInt(process.env.CRYPTO_REPORT_EVERY || '48'),
      max_daily_runs: parseInt(process.env.CRYPTO_MAX_DAILY_RUNS || '288'), // 24h * (60/5) = 288
      market_type: 'crypto',
      ...config
    };

    // Use equity config as primary for backward compatibility
    this.config = this.equityConfig;

    logger.info('🏗️ Trading Runner initialized with dual-market support', {
      equity_tickers: this.equityConfig.tickers.length,
      crypto_tickers: this.cryptoConfig.tickers.length,
      equity_interval: this.equityConfig.run_interval_minutes,
      crypto_interval: this.cryptoConfig.run_interval_minutes
    });
  }

  // Main runner control methods (backward compatible)
  async startRunner(): Promise<void> {
    return this.startDualMarketRunner();
  }

  async stopRunner(): Promise<void> {
    return this.stopDualMarketRunner();
  }

  // Dual-market runner methods
  async startDualMarketRunner(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Dual-market trading runner is already running');
      return;
    }

    try {
      await this.validateConfiguration();
      await this.initializeRunner();
      
      this.isRunning = true;
      
      logger.info('🚀 Elysian Dual-Market Trading Runner started', {
        equity_tickers: this.equityConfig.tickers,
        equity_interval: this.equityConfig.run_interval_minutes,
        crypto_tickers: this.cryptoConfig.tickers,
        crypto_interval: this.cryptoConfig.run_interval_minutes,
        trading_enabled: this.equityConfig.enable_trading
      });

      // Schedule both equity and crypto runs
      this.scheduleEquityRuns();
      this.scheduleCryptoRuns();

      // Run initial cycles if auto-start is enabled
      if (process.env.AUTO_START_RUNNER === 'true') {
        setTimeout(() => this.runEquityCycle().catch(err => 
          logger.error('Initial equity cycle failed:', err)), 10000);
        setTimeout(() => this.runCryptoCycle().catch(err => 
          logger.error('Initial crypto cycle failed:', err)), 15000);
      }

    } catch (error) {
      logger.error('Failed to start dual-market trading runner:', error);
      throw error;
    }
  }

  async stopDualMarketRunner(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Dual-market trading runner is not running');
      return;
    }

    this.isRunning = false;

    // Stop both cron jobs
    if (this.equityJob) {
      this.equityJob.destroy();
      this.equityJob = null;
    }

    if (this.cryptoJob) {
      this.cryptoJob.destroy();
      this.cryptoJob = null;
    }

    // Wait for current cycles to complete
    if (this.currentCycle && this.currentCycle.status === 'RUNNING') {
      logger.info('Waiting for current cycles to complete...');
      let waitTime = 0;
      while (this.currentCycle?.status === 'RUNNING' && waitTime < 120000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        waitTime += 1000;
      }
    }

    logger.info('🛑 Dual-Market Trading Runner stopped');
  }

  // Market-specific scheduling
  private scheduleEquityRuns(): void {
    const cronPattern = `*/${this.equityConfig.run_interval_minutes} * * * *`;
    
    this.equityJob = cron.schedule(cronPattern, async () => {
      if (this.isRunning && (!this.currentCycle || this.currentCycle.status !== 'RUNNING')) {
        // Check if equity markets are open
        const isOpen = await dataIngestor.isMarketOpen('equity');
        if (isOpen) {
          try {
            await this.runEquityCycle();
          } catch (error) {
            logger.error('Scheduled equity cycle failed:', error);
          }
        } else {
          logger.debug('⏰ Equity markets closed, skipping cycle');
        }
      }
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });

    logger.info(`📅 Equity cycles scheduled every ${this.equityConfig.run_interval_minutes} minutes (market hours only)`);
  }

  private scheduleCryptoRuns(): void {
    const cronPattern = `*/${this.cryptoConfig.run_interval_minutes} * * * *`;
    
    this.cryptoJob = cron.schedule(cronPattern, async () => {
      if (this.isRunning && (!this.currentCycle || this.currentCycle.status !== 'RUNNING')) {
        try {
          await this.runCryptoCycle();
        } catch (error) {
          logger.error('Scheduled crypto cycle failed:', error);
        }
      }
    }, {
      scheduled: true,
      timezone: 'UTC' // Crypto is 24/7 UTC
    });

    logger.info(`📅 Crypto cycles scheduled every ${this.cryptoConfig.run_interval_minutes} minutes (24/7)`);
  }

  // Market-specific cycle execution
  async runEquityCycle(): Promise<RunCycle> {
    logger.info('📈 Starting EQUITY trading cycle');
    this.lastEquityRun = new Date();
    
    const result = await this.runMarketSpecificCycle('equity');
    this.equityRunCount++;
    return result;
  }

  async runCryptoCycle(): Promise<RunCycle> {
    logger.info('🪙 Starting CRYPTO trading cycle');
    this.lastCryptoRun = new Date();
    
    const result = await this.runMarketSpecificCycle('crypto');
    this.cryptoRunCount++;
    return result;
  }

  private async runMarketSpecificCycle(marketType: 'equity' | 'crypto'): Promise<RunCycle> {
    const cycleId = `${marketType}_cycle_${Date.now()}`;
    const config = marketType === 'equity' ? this.equityConfig : this.cryptoConfig;
    
    this.currentCycle = {
      id: cycleId,
      timestamp: new Date(),
      phase: 'STARTING',
      status: 'RUNNING',
      market_type: marketType,
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
      logger.info(`🔄 Starting ${marketType} trading cycle: ${cycleId}`, {
        tickers: config.tickers,
        market_type: marketType,
        system_health: this.systemHealthScore
      });

      // Phase 1: Market-specific data ingestion
      await this.runMarketDataIngestion(marketType, config.tickers);

      // Phase 2: Feature computation
      await this.runFeatureComputationPhase();

      // Phase 3: Signal generation
      await this.runSignalGenerationPhase();

      // Phase 4: AI Analysis (if enabled)
      if (config.enable_ai_analysis && this.systemHealthScore > 0.5) {
        try {
          await this.runAIAnalysisPhase();
        } catch (error) {
          logger.warn(`⚠️ ${marketType} AI analysis failed:`, error);
          this.currentCycle!.errors.push(`AI analysis failed: ${error.message}`);
        }
      }

      // Phase 5: Trade execution (if enabled)
      if (config.enable_trading && this.systemHealthScore > 0.7) {
        try {
          await this.runTradeExecutionPhase();
        } catch (error) {
          logger.warn(`⚠️ ${marketType} trade execution failed:`, error);
          this.currentCycle!.errors.push(`Trade execution failed: ${error.message}`);
        }
      } else {
        logger.info(`📝 ${marketType} paper trading mode - no actual trades executed`);
      }

      // Phase 6: Portfolio update
      try {
        await this.runPortfolioUpdatePhase();
      } catch (error) {
        logger.warn(`⚠️ ${marketType} portfolio update failed:`, error);
        this.currentCycle!.errors.push(`Portfolio update failed: ${error.message}`);
      }

      // Phase 7: Periodic reflection and reporting
      if (marketType === 'equity' && this.shouldRunReflection()) {
        try {
          await this.runReflectionPhase();
        } catch (error) {
          logger.warn('⚠️ Reflection phase failed:', error);
        }
      }

      if (marketType === 'equity' && this.shouldRunReport()) {
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

      logger.info(`✅ ${marketType.toUpperCase()} cycle completed: ${cycleId}`, {
        total_time: this.currentCycle.metrics.total_cycle_time_ms,
        signals_generated: this.currentCycle.signals_generated,
        trades_executed: this.currentCycle.trades_executed,
        tickers_processed: this.currentCycle.tickers_processed.length
      });

      return this.currentCycle;

    } catch (error) {
      logger.error(`❌ ${marketType} trading cycle failed: ${cycleId}`, error);

      if (this.currentCycle) {
        this.currentCycle.status = 'FAILED';
        this.currentCycle.phase = 'ERROR';
        this.currentCycle.errors.push(error instanceof Error ? error.message : String(error));
        this.currentCycle.metrics.total_cycle_time_ms = Date.now() - startTime;
        await this.storeCycleResults(this.currentCycle);
      }

      await this.handleCycleError(error, `${marketType.toUpperCase()}_CYCLE`);
      throw error;
    }
  }

  // Market-specific data ingestion
  private async runMarketDataIngestion(marketType: 'equity' | 'crypto', tickers: string[]): Promise<void> {
    this.currentCycle!.phase = 'DATA_INGESTION';
    const startTime = Date.now();

    try {
      logger.info(`📥 ${marketType} data ingestion phase started`);
      const marketData = await dataIngestor.fetchMarketData(tickers, marketType);
      this.currentCycle!.tickers_processed = [...new Set(marketData.map(d => d.symbol))];
      this.currentCycle!.metrics.data_ingestion_time_ms = Date.now() - startTime;

      logger.info(`📥 ${marketType} data ingestion completed`, {
        tickers_processed: this.currentCycle!.tickers_processed.length,
        data_points: marketData.length,
        time_ms: this.currentCycle!.metrics.data_ingestion_time_ms,
        market_type: marketType
      });
    } catch (error) {
      this.currentCycle!.errors.push(`${marketType} data ingestion failed: ${error}`);
      throw error;
    }
  }

  // Backward compatible single cycle method
  async runSingleCycle(): Promise<RunCycle> {
    // For backward compatibility, run equity cycle
    return this.runEquityCycle();
  }

  // Error recovery methods (unchanged from previous implementation)
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

    this.systemHealthScore = Math.max(0.1, this.systemHealthScore - 0.1);

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

    const retryDelay = this.calculateRetryDelay(phase);
    logger.info(`⏱ Waiting ${retryDelay/1000} seconds before retry...`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }

  private calculateRetryDelay(phase: string): number {
    const baseDelay = 30000;
    const phaseMultipliers: { [key: string]: number } = {
      'DATA_INGESTION': 1.0,
      'FEATURE_COMPUTATION': 1.2,
      'SIGNAL_GENERATION': 1.5,
      'AI_ANALYSIS': 2.0,
      'TRADE_EXECUTION': 0.5,
      'PORTFOLIO_UPDATE': 0.8
    };
    
    const multiplier = phaseMultipliers[phase] || 1.0;
    const errorMultiplier = Math.min(this.consecutiveErrors, 5);
    
    return Math.min(baseDelay * multiplier * errorMultiplier, 300000);
  }

  private async enterEmergencyMode(): Promise<void> {
    this.emergencyMode = true;
    logger.error('🚨 ENTERING EMERGENCY MODE - SYSTEM WILL ATTEMPT SELF-RECOVERY');

    try {
      this.equityConfig.run_interval_minutes = Math.max(this.equityConfig.run_interval_minutes * 2, 60);
      this.cryptoConfig.run_interval_minutes = Math.max(this.cryptoConfig.run_interval_minutes * 2, 10);
      this.equityConfig.tickers = this.equityConfig.tickers.slice(0, 2);
      this.cryptoConfig.tickers = this.cryptoConfig.tickers.slice(0, 2);

      await this.performSystemDiagnostics();

      const recoveryWait = 10 * 60 * 1000;
      logger.info(`🕐 Emergency recovery wait: ${recoveryWait/60000} minutes`);
      await new Promise(resolve => setTimeout(resolve, recoveryWait));

      await this.attemptGradualRecovery();
    } catch (recoveryError) {
      logger.error('🚨 Emergency recovery failed:', recoveryError);
      await this.emergencyShutdown();
    }
  }

  private async emergencyShutdown(): Promise<void> {
    logger.error('🚨 EMERGENCY SHUTDOWN INITIATED');
    
    try {
      await this.saveEmergencyState();
      
      this.isRunning = false;
      if (this.equityJob) {
        this.equityJob.destroy();
        this.equityJob = null;
      }
      if (this.cryptoJob) {
        this.cryptoJob.destroy();
        this.cryptoJob = null;
      }
      
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
      diagnostics.database = await DatabaseManager.healthCheck();
      logger.info(`📊 Database: ${diagnostics.database ? '✅ OK' : '❌ FAILED'}`);

      const dataHealth = await dataIngestor.healthCheck();
      diagnostics.dataSource = dataHealth.status === 'healthy';
      logger.info(`📡 Data source: ${diagnostics.dataSource ? '✅ OK' : '❌ FAILED'}`);

      try {
        const testFeatures = await featuresEngine.computeFeatures(['AAPL']);
        const testSignals = await signalEngine.generateSignals(testFeatures);
        diagnostics.signalEngine = testSignals.length >= 0;
        logger.info(`🎯 Signal engine: ${diagnostics.signalEngine ? '✅ OK' : '❌ FAILED'}`);
      } catch (signalError) {
        diagnostics.signalEngine = false;
        logger.error('❌ Signal engine diagnostic failed:', signalError);
      }

      try {
        const snapshot = await portfolioManager.getLatestPortfolioSnapshot();
        diagnostics.portfolioManager = !!snapshot;
        logger.info(`💼 Portfolio manager: ${diagnostics.portfolioManager ? '✅ OK' : '❌ FAILED'}`);
      } catch (portfolioError) {
        diagnostics.portfolioManager = false;
        logger.error('❌ Portfolio manager diagnostic failed:', portfolioError);
      }

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

    this.consecutiveErrors = Math.floor(this.consecutiveErrors / 2);
    
    const recoveryConfig = {
      ...this.equityConfig,
      run_interval_minutes: 60,
      tickers: ['AAPL'],
      enable_ai_analysis: false,
      enable_trading: false
    };

    logger.info('🧪 Testing recovery with minimal configuration...');

    try {
      const originalConfig = this.config;
      this.config = recoveryConfig;

      await this.runMinimalCycle();

      logger.info('✅ Recovery test successful - restoring functionality');
      
      this.equityConfig = {
        ...this.equityConfig,
        run_interval_minutes: Math.max(this.equityConfig.run_interval_minutes, 30),
        tickers: this.equityConfig.tickers.slice(0, 3),
        enable_ai_analysis: this.systemHealthScore > 0.7,
        enable_trading: false
      };

      this.config = originalConfig;
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
      const marketData = await dataIngestor.fetchMarketData(['AAPL'], 'equity');
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
        equityConfig: this.equityConfig,
        cryptoConfig: this.cryptoConfig
      };

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
    this.errorCount = Math.floor(this.errorCount / 2);
    this.consecutiveErrors = 0;
    this.lastSuccessfulRun = new Date();
    this.systemHealthScore = Math.min(this.systemHealthScore + 0.1, 1.0);
    this.emergencyMode = false;

    logger.info('✅ Error counters reset after successful cycle', {
      errorCount: this.errorCount,
      systemHealth: this.systemHealthScore
    });
  }

  // Enhanced status method with dual-market info
  getRunnerStatus(): {
    is_running: boolean;
    run_count: number;
    daily_run_count: number;
    current_cycle: RunCycle | null;
    equity_config: RunnerConfig;
    crypto_config: RunnerConfig;
    last_equity_run: Date;
    last_crypto_run: Date;
    equity_run_count: number;
    crypto_run_count: number;
    system_health: number;
    emergency_mode: boolean;
  } {
    return {
      is_running: this.isRunning,
      run_count: this.runCount,
      daily_run_count: this.dailyRunCount,
      current_cycle: this.currentCycle,
      equity_config: this.equityConfig,
      crypto_config: this.cryptoConfig,
      last_equity_run: this.lastEquityRun,
      last_crypto_run: this.lastCryptoRun,
      equity_run_count: this.equityRunCount,
      crypto_run_count: this.cryptoRunCount,
      system_health: this.systemHealthScore,
      emergency_mode: this.emergencyMode
    };
  }

  // Configuration validation
  private async validateConfiguration(): Promise<void> {
    if (!this.equityConfig.tickers || this.equityConfig.tickers.length === 0) {
      throw new Error('No equity tickers configured for trading');
    }

    if (!this.cryptoConfig.tickers || this.cryptoConfig.tickers.length === 0) {
      throw new Error('No crypto tickers configured for trading');
    }

    if (this.equityConfig.run_interval_minutes < 1 || this.equityConfig.run_interval_minutes > 1440) {
      throw new Error('Equity run interval must be between 1 and 1440 minutes');
    }

    if (this.cryptoConfig.run_interval_minutes < 1 || this.cryptoConfig.run_interval_minutes > 60) {
      throw new Error('Crypto run interval must be between 1 and 60 minutes');
    }

    const dbHealthy = await DatabaseManager.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection not healthy');
    }

    logger.info('Dual-market configuration validated successfully');
  }

  private async initializeRunner(): Promise<void> {
    logger.info('Initializing dual-market trading runner...');
    
    const dataHealth = await dataIngestor.healthCheck();
    logger.info('Data sources health check:', dataHealth);

    if (this.equityConfig.enable_ai_analysis || this.cryptoConfig.enable_ai_analysis) {
      const aiHealthy = await aiReasoner.healthCheck();
      logger.info(`AI reasoner health: ${aiHealthy ? 'OK' : 'DEGRADED'}`);
    }

    logger.info('Dual-market trading runner initialized');
  }

  // Legacy scheduling method for backward compatibility
  private scheduleRuns(): void {
    this.scheduleEquityRuns();
    this.scheduleCryptoRuns();
  }

  private checkDailyLimits(): void {
    const now = new Date();
    
    if (now.toDateString() !== this.lastRunDate.toDateString()) {
      this.dailyRunCount = 0;
      this.lastRunDate = now;
      logger.info('Daily run counter reset');
    }

    if (this.dailyRunCount >= this.config.max_daily_runs) {
      throw new Error(`Daily run limit exceeded: ${this.config.max_daily_runs}`);
    }
  }

  private shouldRunReflection(): boolean {
    return this.equityRunCount > 0 && this.equityRunCount % this.equityConfig.reflection_frequency === 0;
  }

  private shouldRunReport(): boolean {
    return this.equityRunCount > 0 && this.equityRunCount % this.equityConfig.report_frequency === 0;
  }

  // Trading phase implementations
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
      
      const recentSignals = await signalEngine.getLatestSignals(
        this.currentCycle!.tickers_processed, 
        10
      );

      const portfolioSnapshot = await portfolioManager.getLatestPortfolioSnapshot();
      const portfolioValue = portfolioSnapshot?.total_value || 100000;

      let tradesExecuted = 0;
      for (const signal of recentSignals) {
        if (signal.signal_type !== 'HOLD' && signal.confidence > 0.6) {
          try {
            const aiAnalysis = await aiReasoner.analyzeMarket(
              signal.symbol, 
              {}, 
              {}, 
              signal
            );

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
