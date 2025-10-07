"use strict";
/**
 * Elysian Trading System - Main Runner
 * Orchestrates the complete autonomous trading cycle
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradingRunner = exports.TradingRunner = void 0;
const logger_1 = require("@/utils/logger");
const database_1 = require("@/utils/database");
const data_ingestor_1 = require("@/data_ingestor");
const features_1 = require("@/features");
const signal_engine_1 = require("@/signal_engine");
const ai_reasoner_1 = require("@/ai_reasoner");
const execution_1 = require("@/execution");
const portfolio_1 = require("@/portfolio");
const reflection_1 = require("@/reflection");
const reports_1 = require("@/reports");
const cron = __importStar(require("node-cron"));
class TradingRunner {
    constructor(config) {
        this.isRunning = false;
        this.currentCycle = null;
        this.runCount = 0;
        this.dailyRunCount = 0;
        this.lastRunDate = new Date();
        this.cronJob = null;
        this.config = {
            tickers: process.env.RUNNER_TICKERS?.split(',') || ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'],
            run_interval_minutes: parseInt(process.env.RUN_INTERVAL_MINUTES || '15'),
            enable_trading: process.env.ELYSIAN_LIVE === 'true',
            enable_ai_analysis: process.env.ENABLE_AI_ANALYSIS !== 'false',
            reflection_frequency: parseInt(process.env.RUN_REFLECTION_EVERY || '12'), // Every 12 runs (~3 hours)
            report_frequency: parseInt(process.env.RUN_REPORT_EVERY || '24'), // Every 24 runs (~6 hours)
            max_daily_runs: parseInt(process.env.MAX_DAILY_RUNS || '96'), // 4 per hour * 24 hours
            ...config
        };
    }
    async startRunner() {
        if (this.isRunning) {
            logger_1.logger.warn('Trading runner is already running');
            return;
        }
        try {
            await this.validateConfiguration();
            await this.initializeRunner();
            this.isRunning = true;
            logger_1.logger.info('🚀 Elysian Trading Runner started', {
                tickers: this.config.tickers,
                interval_minutes: this.config.run_interval_minutes,
                trading_enabled: this.config.enable_trading,
                ai_enabled: this.config.enable_ai_analysis
            });
            // Start scheduled runs
            this.scheduleRuns();
            // Run initial cycle if configured
            if (process.env.AUTO_START_RUNNER === 'true') {
                setTimeout(() => this.runSingleCycle(), 5000); // Wait 5 seconds for initialization
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to start trading runner:', error);
            throw error;
        }
    }
    async stopRunner() {
        if (!this.isRunning) {
            logger_1.logger.warn('Trading runner is not running');
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
            logger_1.logger.info('Waiting for current trading cycle to complete...');
            // Give it up to 2 minutes to complete
            let waitTime = 0;
            while (this.currentCycle?.status === 'RUNNING' && waitTime < 120000) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                waitTime += 1000;
            }
        }
        logger_1.logger.info('🛑 Elysian Trading Runner stopped');
    }
    async runSingleCycle() {
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
            logger_1.logger.info(`🔄 Starting trading cycle: ${cycleId}`, {
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
            }
            else {
                logger_1.logger.info('📝 Paper trading mode - no actual trades executed');
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
            logger_1.logger.info(`✅ Trading cycle completed: ${cycleId}`, {
                total_time: this.currentCycle.metrics.total_cycle_time_ms,
                signals_generated: this.currentCycle.signals_generated,
                trades_executed: this.currentCycle.trades_executed,
                portfolio_change: this.currentCycle.results.portfolio_value_change
            });
            return this.currentCycle;
        }
        catch (error) {
            logger_1.logger.error(`❌ Trading cycle failed: ${cycleId}`, error);
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
    async runDataIngestionPhase() {
        this.currentCycle.phase = 'DATA_INGESTION';
        const startTime = Date.now();
        try {
            logger_1.logger.info('📥 Data ingestion phase started');
            const marketData = await data_ingestor_1.dataIngestor.fetchMarketData(this.config.tickers);
            this.currentCycle.tickers_processed = [...new Set(marketData.map(d => d.symbol))];
            this.currentCycle.metrics.data_ingestion_time_ms = Date.now() - startTime;
            logger_1.logger.info('📥 Data ingestion completed', {
                tickers_processed: this.currentCycle.tickers_processed.length,
                data_points: marketData.length,
                time_ms: this.currentCycle.metrics.data_ingestion_time_ms
            });
        }
        catch (error) {
            this.currentCycle.errors.push(`Data ingestion failed: ${error}`);
            throw error;
        }
    }
    async runFeatureComputationPhase() {
        this.currentCycle.phase = 'FEATURE_COMPUTATION';
        const startTime = Date.now();
        try {
            logger_1.logger.info('🔧 Feature computation phase started');
            const features = await features_1.featuresEngine.computeFeatures(this.currentCycle.tickers_processed);
            this.currentCycle.metrics.feature_computation_time_ms = Date.now() - startTime;
            logger_1.logger.info('🔧 Feature computation completed', {
                features_computed: features.length,
                time_ms: this.currentCycle.metrics.feature_computation_time_ms
            });
        }
        catch (error) {
            this.currentCycle.errors.push(`Feature computation failed: ${error}`);
            throw error;
        }
    }
    async runSignalGenerationPhase() {
        this.currentCycle.phase = 'SIGNAL_GENERATION';
        const startTime = Date.now();
        try {
            logger_1.logger.info('📊 Signal generation phase started');
            // Get latest features
            const features = await features_1.featuresEngine.getLatestFeatures(this.currentCycle.tickers_processed);
            const signals = await signal_engine_1.signalEngine.generateSignals(features);
            this.currentCycle.signals_generated = signals.length;
            this.currentCycle.metrics.signal_generation_time_ms = Date.now() - startTime;
            logger_1.logger.info('📊 Signal generation completed', {
                signals_generated: signals.length,
                time_ms: this.currentCycle.metrics.signal_generation_time_ms
            });
        }
        catch (error) {
            this.currentCycle.errors.push(`Signal generation failed: ${error}`);
            throw error;
        }
    }
    async runAIAnalysisPhase() {
        this.currentCycle.phase = 'AI_ANALYSIS';
        const startTime = Date.now();
        try {
            logger_1.logger.info('🤖 AI analysis phase started');
            // Get data for AI analysis
            const features = await features_1.featuresEngine.getLatestFeatures(this.currentCycle.tickers_processed);
            const signals = await signal_engine_1.signalEngine.getLatestSignals(this.currentCycle.tickers_processed, 10);
            let analysesCompleted = 0;
            for (const featureSet of features) {
                try {
                    const marketData = await data_ingestor_1.dataIngestor.getHistoricalData(featureSet.symbol, 7);
                    const symbolSignals = signals.filter(s => s.symbol === featureSet.symbol);
                    if (marketData.length > 0) {
                        await ai_reasoner_1.aiReasoner.analyzeMarket(featureSet.symbol, marketData, featureSet, symbolSignals);
                        analysesCompleted++;
                    }
                }
                catch (error) {
                    logger_1.logger.warn(`AI analysis failed for ${featureSet.symbol}:`, error);
                }
            }
            this.currentCycle.metrics.ai_analysis_time_ms = Date.now() - startTime;
            logger_1.logger.info('🤖 AI analysis completed', {
                analyses_completed: analysesCompleted,
                time_ms: this.currentCycle.metrics.ai_analysis_time_ms
            });
        }
        catch (error) {
            this.currentCycle.errors.push(`AI analysis failed: ${error}`);
            throw error;
        }
    }
    async runTradeExecutionPhase() {
        this.currentCycle.phase = 'TRADE_EXECUTION';
        const startTime = Date.now();
        try {
            logger_1.logger.info('⚡ Trade execution phase started');
            const signals = await signal_engine_1.signalEngine.getLatestSignals(this.currentCycle.tickers_processed, 20);
            const aiAnalyses = await ai_reasoner_1.aiReasoner.getLatestAnalysis(this.currentCycle.tickers_processed);
            const latestPortfolio = await portfolio_1.portfolioManager.getLatestPortfolioSnapshot();
            const portfolioValue = latestPortfolio?.total_value || 100000;
            let tradesExecuted = 0;
            for (const signal of signals) {
                try {
                    // Find matching AI analysis
                    const aiAnalysis = aiAnalyses.find(ai => ai.symbol === signal.symbol &&
                        Math.abs(ai.timestamp.getTime() - signal.timestamp.getTime()) < 30 * 60 * 1000 // Within 30 minutes
                    );
                    if (aiAnalysis) {
                        const trade = await execution_1.executionEngine.evaluateAndExecute(signal, aiAnalysis, portfolioValue);
                        if (trade) {
                            tradesExecuted++;
                        }
                    }
                    else {
                        logger_1.logger.debug(`No AI analysis found for ${signal.symbol} signal`);
                    }
                }
                catch (error) {
                    logger_1.logger.warn(`Trade execution failed for ${signal.symbol}:`, error);
                }
            }
            this.currentCycle.trades_executed = tradesExecuted;
            this.currentCycle.metrics.execution_time_ms = Date.now() - startTime;
            logger_1.logger.info('⚡ Trade execution completed', {
                trades_executed: tradesExecuted,
                signals_evaluated: signals.length,
                time_ms: this.currentCycle.metrics.execution_time_ms
            });
        }
        catch (error) {
            this.currentCycle.errors.push(`Trade execution failed: ${error}`);
            throw error;
        }
    }
    async runPortfolioUpdatePhase() {
        this.currentCycle.phase = 'PORTFOLIO_UPDATE';
        try {
            logger_1.logger.info('💼 Portfolio update phase started');
            const previousSnapshot = await portfolio_1.portfolioManager.getLatestPortfolioSnapshot();
            const previousValue = previousSnapshot?.total_value || 100000;
            const currentSnapshot = await portfolio_1.portfolioManager.createPortfolioSnapshot();
            this.currentCycle.results = {
                portfolio_value_change: currentSnapshot.total_value - previousValue,
                new_positions: currentSnapshot.positions.length - (previousSnapshot?.positions.length || 0),
                closed_positions: 0, // Would need proper calculation
                daily_pnl: currentSnapshot.daily_pnl
            };
            logger_1.logger.info('💼 Portfolio update completed', {
                current_value: currentSnapshot.total_value,
                value_change: this.currentCycle.results.portfolio_value_change,
                daily_pnl: currentSnapshot.daily_pnl
            });
        }
        catch (error) {
            this.currentCycle.errors.push(`Portfolio update failed: ${error}`);
            throw error;
        }
    }
    async runReflectionPhase() {
        this.currentCycle.phase = 'REFLECTION';
        try {
            logger_1.logger.info('🤔 Reflection phase started');
            const reflection = await reflection_1.reflectionEngine.generateReflection(7); // Last 7 days
            logger_1.logger.info('🤔 Reflection completed', {
                insights: reflection.key_insights.length,
                mistakes: reflection.mistakes_identified.length,
                recommendations: reflection.recommended_adjustments.length,
                confidence: reflection.confidence_score
            });
        }
        catch (error) {
            logger_1.logger.warn('Reflection phase failed:', error);
            this.currentCycle.errors.push(`Reflection failed: ${error}`);
        }
    }
    async runReportingPhase() {
        this.currentCycle.phase = 'REPORTING';
        try {
            logger_1.logger.info('📊 Reporting phase started');
            const report = await reports_1.reportsGenerator.generatePerformanceReport(30); // Last 30 days
            logger_1.logger.info('📊 Reporting completed', {
                total_return: report.executive_summary.total_return_pct,
                sharpe_ratio: report.executive_summary.sharpe_ratio,
                recommendations: report.recommendations.length
            });
        }
        catch (error) {
            logger_1.logger.warn('Reporting phase failed:', error);
            this.currentCycle.errors.push(`Reporting failed: ${error}`);
        }
    }
    scheduleRuns() {
        const cronPattern = `*/${this.config.run_interval_minutes} * * * *`;
        this.cronJob = cron.schedule(cronPattern, async () => {
            if (this.isRunning && (!this.currentCycle || this.currentCycle.status !== 'RUNNING')) {
                try {
                    await this.runSingleCycle();
                }
                catch (error) {
                    logger_1.logger.error('Scheduled trading cycle failed:', error);
                }
            }
        }, {
            scheduled: true,
            timezone: 'America/New_York' // Market timezone
        });
        logger_1.logger.info(`📅 Trading cycles scheduled every ${this.config.run_interval_minutes} minutes`);
    }
    checkDailyLimits() {
        const now = new Date();
        // Reset daily counter if new day
        if (now.toDateString() !== this.lastRunDate.toDateString()) {
            this.dailyRunCount = 0;
            this.lastRunDate = now;
            logger_1.logger.info('Daily run counter reset');
        }
        // Check daily limits
        if (this.dailyRunCount >= this.config.max_daily_runs) {
            throw new Error(`Daily run limit exceeded: ${this.config.max_daily_runs}`);
        }
    }
    shouldRunReflection() {
        return this.runCount > 0 && this.runCount % this.config.reflection_frequency === 0;
    }
    shouldRunReport() {
        return this.runCount > 0 && this.runCount % this.config.report_frequency === 0;
    }
    async validateConfiguration() {
        // Validate tickers
        if (!this.config.tickers || this.config.tickers.length === 0) {
            throw new Error('No tickers configured for trading');
        }
        // Validate intervals
        if (this.config.run_interval_minutes < 1 || this.config.run_interval_minutes > 1440) {
            throw new Error('Run interval must be between 1 and 1440 minutes');
        }
        // Check database connectivity
        const dbHealthy = await database_1.DatabaseManager.healthCheck();
        if (!dbHealthy) {
            throw new Error('Database connection not healthy');
        }
        logger_1.logger.info('Configuration validated successfully');
    }
    async initializeRunner() {
        // Initialize system state
        logger_1.logger.info('Initializing trading runner...');
        // Check data source health
        const dataHealth = await data_ingestor_1.dataIngestor.healthCheck();
        logger_1.logger.info('Data sources health check:', dataHealth);
        // Check AI reasoner if enabled
        if (this.config.enable_ai_analysis) {
            const aiHealthy = await ai_reasoner_1.aiReasoner.healthCheck();
            logger_1.logger.info(`AI reasoner health: ${aiHealthy ? 'OK' : 'DEGRADED'}`);
        }
        logger_1.logger.info('Trading runner initialized');
    }
    async storeCycleResults(cycle) {
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
            await database_1.DatabaseManager.query(query, [
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
        }
        catch (error) {
            logger_1.logger.error('Failed to store cycle results:', error);
        }
    }
    // Public getters
    getRunnerStatus() {
        return {
            is_running: this.isRunning,
            run_count: this.runCount,
            daily_run_count: this.dailyRunCount,
            current_cycle: this.currentCycle,
            config: this.config
        };
    }
    async getRunHistory(limit = 20) {
        try {
            const query = `
        SELECT * FROM runner_cycles
        ORDER BY timestamp DESC
        LIMIT $1
      `;
            const result = await database_1.DatabaseManager.query(query, [limit]);
            return result.rows.map((row) => ({
                id: row.id,
                timestamp: new Date(row.timestamp),
                phase: row.phase,
                status: row.status,
                tickers_processed: JSON.parse(row.tickers_processed || '[]'),
                signals_generated: parseInt(row.signals_generated),
                trades_executed: parseInt(row.trades_executed),
                errors: JSON.parse(row.errors || '[]'),
                metrics: JSON.parse(row.metrics || '{}'),
                results: JSON.parse(row.results || '{}')
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get run history:', error);
            return [];
        }
    }
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        logger_1.logger.info('Runner configuration updated', newConfig);
    }
}
exports.TradingRunner = TradingRunner;
exports.tradingRunner = new TradingRunner();
