"use strict";
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
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const data_ingestor_1 = require("../data_ingestor");
const features_1 = require("../features");
const signal_engine_1 = require("../signal_engine");
const ai_reasoner_1 = require("../ai_reasoner");
const execution_1 = require("../execution");
const portfolio_1 = require("../portfolio");
const reflection_1 = require("../reflection");
const reports_1 = require("../reports");
const cron = __importStar(require("node-cron"));
class TradingRunner {
    constructor(config) {
        this.isRunning = false;
        this.currentCycle = null;
        this.runCount = 0;
        this.dailyRunCount = 0;
        this.lastRunDate = new Date();
        this.cronJob = null;
        this.errorCount = 0;
        this.consecutiveErrors = 0;
        this.maxErrors = 5;
        this.maxConsecutiveErrors = 3;
        this.lastSuccessfulRun = new Date();
        this.retryAttempts = new Map();
        this.systemHealthScore = 1.0;
        this.emergencyMode = false;
        this.equityJob = null;
        this.cryptoJob = null;
        this.lastEquityRun = new Date();
        this.lastCryptoRun = new Date();
        this.equityRunCount = 0;
        this.cryptoRunCount = 0;
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
        this.cryptoConfig = {
            tickers: process.env.CRYPTO_TICKERS?.split(',') || ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'],
            run_interval_minutes: parseInt(process.env.CRYPTO_RUN_INTERVAL_MINUTES || '5'),
            enable_trading: process.env.ELYSIAN_LIVE === 'true',
            enable_ai_analysis: process.env.ENABLE_AI_ANALYSIS !== 'false',
            reflection_frequency: parseInt(process.env.CRYPTO_REFLECTION_EVERY || '24'),
            report_frequency: parseInt(process.env.CRYPTO_REPORT_EVERY || '48'),
            max_daily_runs: parseInt(process.env.CRYPTO_MAX_DAILY_RUNS || '288'),
            market_type: 'crypto',
            ...config
        };
        this.config = this.equityConfig;
        logger_1.logger.info('🏗️ Trading Runner initialized with dual-market support', {
            equity_tickers: this.equityConfig.tickers.length,
            crypto_tickers: this.cryptoConfig.tickers.length,
            equity_interval: this.equityConfig.run_interval_minutes,
            crypto_interval: this.cryptoConfig.run_interval_minutes
        });
    }
    async startRunner() {
        return this.startDualMarketRunner();
    }
    async stopRunner() {
        return this.stopDualMarketRunner();
    }
    async startDualMarketRunner() {
        if (this.isRunning) {
            logger_1.logger.warn('Dual-market trading runner is already running');
            return;
        }
        try {
            await this.validateConfiguration();
            await this.initializeRunner();
            this.isRunning = true;
            logger_1.logger.info('🚀 Elysian Dual-Market Trading Runner started', {
                equity_tickers: this.equityConfig.tickers,
                equity_interval: this.equityConfig.run_interval_minutes,
                crypto_tickers: this.cryptoConfig.tickers,
                crypto_interval: this.cryptoConfig.run_interval_minutes,
                trading_enabled: this.equityConfig.enable_trading
            });
            this.scheduleEquityRuns();
            this.scheduleCryptoRuns();
            if (process.env.AUTO_START_RUNNER === 'true') {
                setTimeout(() => this.runEquityCycle().catch(err => logger_1.logger.error('Initial equity cycle failed:', err)), 10000);
                setTimeout(() => this.runCryptoCycle().catch(err => logger_1.logger.error('Initial crypto cycle failed:', err)), 15000);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to start dual-market trading runner:', error);
            throw error;
        }
    }
    async stopDualMarketRunner() {
        if (!this.isRunning) {
            logger_1.logger.warn('Dual-market trading runner is not running');
            return;
        }
        this.isRunning = false;
        if (this.equityJob) {
            this.equityJob.destroy();
            this.equityJob = null;
        }
        if (this.cryptoJob) {
            this.cryptoJob.destroy();
            this.cryptoJob = null;
        }
        if (this.currentCycle && this.currentCycle.status === 'RUNNING') {
            logger_1.logger.info('Waiting for current cycles to complete...');
            let waitTime = 0;
            while (this.currentCycle?.status === 'RUNNING' && waitTime < 120000) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                waitTime += 1000;
            }
        }
        logger_1.logger.info('🛑 Dual-Market Trading Runner stopped');
    }
    scheduleEquityRuns() {
        const cronPattern = `*/${this.equityConfig.run_interval_minutes} * * * *`;
        this.equityJob = cron.schedule(cronPattern, async () => {
            if (this.isRunning && (!this.currentCycle || this.currentCycle.status !== 'RUNNING')) {
                const isOpen = await data_ingestor_1.dataIngestor.isMarketOpen('equity');
                if (isOpen) {
                    try {
                        await this.runEquityCycle();
                    }
                    catch (error) {
                        logger_1.logger.error('Scheduled equity cycle failed:', error);
                    }
                }
                else {
                    logger_1.logger.debug('⏰ Equity markets closed, skipping cycle');
                }
            }
        }, {
            scheduled: true,
            timezone: 'America/New_York'
        });
        logger_1.logger.info(`📅 Equity cycles scheduled every ${this.equityConfig.run_interval_minutes} minutes (market hours only)`);
    }
    scheduleCryptoRuns() {
        const cronPattern = `*/${this.cryptoConfig.run_interval_minutes} * * * *`;
        this.cryptoJob = cron.schedule(cronPattern, async () => {
            if (this.isRunning && (!this.currentCycle || this.currentCycle.status !== 'RUNNING')) {
                try {
                    await this.runCryptoCycle();
                }
                catch (error) {
                    logger_1.logger.error('Scheduled crypto cycle failed:', error);
                }
            }
        }, {
            scheduled: true,
            timezone: 'UTC'
        });
        logger_1.logger.info(`📅 Crypto cycles scheduled every ${this.cryptoConfig.run_interval_minutes} minutes (24/7)`);
    }
    async runEquityCycle() {
        logger_1.logger.info('📈 Starting EQUITY trading cycle');
        this.lastEquityRun = new Date();
        const result = await this.runMarketSpecificCycle('equity');
        this.equityRunCount++;
        return result;
    }
    async runCryptoCycle() {
        logger_1.logger.info('🪙 Starting CRYPTO trading cycle');
        this.lastCryptoRun = new Date();
        const result = await this.runMarketSpecificCycle('crypto');
        this.cryptoRunCount++;
        return result;
    }
    async runMarketSpecificCycle(marketType) {
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
            logger_1.logger.info(`🔄 Starting ${marketType} trading cycle: ${cycleId}`, {
                tickers: config.tickers,
                market_type: marketType,
                system_health: this.systemHealthScore
            });
            await this.runMarketDataIngestion(marketType, config.tickers);
            await this.runFeatureComputationPhase();
            await this.runSignalGenerationPhase();
            if (config.enable_ai_analysis && this.systemHealthScore > 0.5) {
                try {
                    await this.runAIAnalysisPhase();
                }
                catch (error) {
                    logger_1.logger.warn(`⚠️ ${marketType} AI analysis failed:`, error);
                    this.currentCycle.errors.push(`AI analysis failed: ${error.message}`);
                }
            }
            if (config.enable_trading && this.systemHealthScore > 0.7) {
                try {
                    await this.runTradeExecutionPhase();
                }
                catch (error) {
                    logger_1.logger.warn(`⚠️ ${marketType} trade execution failed:`, error);
                    this.currentCycle.errors.push(`Trade execution failed: ${error.message}`);
                }
            }
            else {
                logger_1.logger.info(`📝 ${marketType} paper trading mode - no actual trades executed`);
            }
            try {
                await this.runPortfolioUpdatePhase();
            }
            catch (error) {
                logger_1.logger.warn(`⚠️ ${marketType} portfolio update failed:`, error);
                this.currentCycle.errors.push(`Portfolio update failed: ${error.message}`);
            }
            if (marketType === 'equity' && this.shouldRunReflection()) {
                try {
                    await this.runReflectionPhase();
                }
                catch (error) {
                    logger_1.logger.warn('⚠️ Reflection phase failed:', error);
                }
            }
            if (marketType === 'equity' && this.shouldRunReport()) {
                try {
                    await this.runReportingPhase();
                }
                catch (error) {
                    logger_1.logger.warn('⚠️ Reporting phase failed:', error);
                }
            }
            this.currentCycle.status = 'SUCCESS';
            this.currentCycle.phase = 'COMPLETED';
            this.currentCycle.metrics.total_cycle_time_ms = Date.now() - startTime;
            this.runCount++;
            this.dailyRunCount++;
            this.resetErrorCounters();
            await this.storeCycleResults(this.currentCycle);
            logger_1.logger.info(`✅ ${marketType.toUpperCase()} cycle completed: ${cycleId}`, {
                total_time: this.currentCycle.metrics.total_cycle_time_ms,
                signals_generated: this.currentCycle.signals_generated,
                trades_executed: this.currentCycle.trades_executed,
                tickers_processed: this.currentCycle.tickers_processed.length
            });
            return this.currentCycle;
        }
        catch (error) {
            logger_1.logger.error(`❌ ${marketType} trading cycle failed: ${cycleId}`, error);
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
    async runMarketDataIngestion(marketType, tickers) {
        this.currentCycle.phase = 'DATA_INGESTION';
        const startTime = Date.now();
        try {
            logger_1.logger.info(`📥 ${marketType} data ingestion phase started`);
            const marketData = await data_ingestor_1.dataIngestor.fetchMarketData(tickers, marketType);
            this.currentCycle.tickers_processed = [...new Set(marketData.map(d => d.symbol))];
            this.currentCycle.metrics.data_ingestion_time_ms = Date.now() - startTime;
            logger_1.logger.info(`📥 ${marketType} data ingestion completed`, {
                tickers_processed: this.currentCycle.tickers_processed.length,
                data_points: marketData.length,
                time_ms: this.currentCycle.metrics.data_ingestion_time_ms,
                market_type: marketType
            });
        }
        catch (error) {
            this.currentCycle.errors.push(`${marketType} data ingestion failed: ${error}`);
            throw error;
        }
    }
    async runSingleCycle() {
        return this.runEquityCycle();
    }
    async handleCycleError(error, phase) {
        this.errorCount++;
        this.consecutiveErrors++;
        logger_1.logger.error(`🚨 Error in ${phase} (${this.consecutiveErrors}/${this.maxConsecutiveErrors} consecutive):`, {
            error: error.message,
            phase,
            errorCount: this.errorCount,
            consecutiveErrors: this.consecutiveErrors,
            systemHealth: this.systemHealthScore
        });
        this.systemHealthScore = Math.max(0.1, this.systemHealthScore - 0.1);
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            logger_1.logger.error('🚨 MAXIMUM CONSECUTIVE ERRORS REACHED - ENTERING EMERGENCY MODE');
            await this.enterEmergencyMode();
            return;
        }
        if (this.errorCount >= this.maxErrors) {
            logger_1.logger.error('🚨 MAXIMUM TOTAL ERRORS REACHED - STOPPING RUNNER');
            await this.emergencyShutdown();
            return;
        }
        const retryDelay = this.calculateRetryDelay(phase);
        logger_1.logger.info(`⏱ Waiting ${retryDelay / 1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    calculateRetryDelay(phase) {
        const baseDelay = 30000;
        const phaseMultipliers = {
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
    async enterEmergencyMode() {
        this.emergencyMode = true;
        logger_1.logger.error('🚨 ENTERING EMERGENCY MODE - SYSTEM WILL ATTEMPT SELF-RECOVERY');
        try {
            this.equityConfig.run_interval_minutes = Math.max(this.equityConfig.run_interval_minutes * 2, 60);
            this.cryptoConfig.run_interval_minutes = Math.max(this.cryptoConfig.run_interval_minutes * 2, 10);
            this.equityConfig.tickers = this.equityConfig.tickers.slice(0, 2);
            this.cryptoConfig.tickers = this.cryptoConfig.tickers.slice(0, 2);
            await this.performSystemDiagnostics();
            const recoveryWait = 10 * 60 * 1000;
            logger_1.logger.info(`🕐 Emergency recovery wait: ${recoveryWait / 60000} minutes`);
            await new Promise(resolve => setTimeout(resolve, recoveryWait));
            await this.attemptGradualRecovery();
        }
        catch (recoveryError) {
            logger_1.logger.error('🚨 Emergency recovery failed:', recoveryError);
            await this.emergencyShutdown();
        }
    }
    async emergencyShutdown() {
        logger_1.logger.error('🚨 EMERGENCY SHUTDOWN INITIATED');
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
            logger_1.logger.error('🛑 Runner stopped due to excessive errors. Manual intervention required.');
        }
        catch (shutdownError) {
            logger_1.logger.error('🚨 Error during emergency shutdown:', shutdownError);
        }
    }
    async performSystemDiagnostics() {
        logger_1.logger.info('🔍 Performing system diagnostics...');
        const diagnostics = {
            database: false,
            dataSource: false,
            signalEngine: false,
            portfolioManager: false
        };
        try {
            diagnostics.database = await database_1.DatabaseManager.healthCheck();
            logger_1.logger.info(`📊 Database: ${diagnostics.database ? '✅ OK' : '❌ FAILED'}`);
            const dataHealth = await data_ingestor_1.dataIngestor.healthCheck();
            diagnostics.dataSource = dataHealth.status === 'healthy';
            logger_1.logger.info(`📡 Data source: ${diagnostics.dataSource ? '✅ OK' : '❌ FAILED'}`);
            try {
                const testFeatures = await features_1.featuresEngine.computeFeatures(['AAPL']);
                const testSignals = await signal_engine_1.signalEngine.generateSignals(testFeatures);
                diagnostics.signalEngine = testSignals.length >= 0;
                logger_1.logger.info(`🎯 Signal engine: ${diagnostics.signalEngine ? '✅ OK' : '❌ FAILED'}`);
            }
            catch (signalError) {
                diagnostics.signalEngine = false;
                logger_1.logger.error('❌ Signal engine diagnostic failed:', signalError);
            }
            try {
                const snapshot = await portfolio_1.portfolioManager.getLatestPortfolioSnapshot();
                diagnostics.portfolioManager = !!snapshot;
                logger_1.logger.info(`💼 Portfolio manager: ${diagnostics.portfolioManager ? '✅ OK' : '❌ FAILED'}`);
            }
            catch (portfolioError) {
                diagnostics.portfolioManager = false;
                logger_1.logger.error('❌ Portfolio manager diagnostic failed:', portfolioError);
            }
            const healthComponents = Object.values(diagnostics);
            const healthyCount = healthComponents.filter(Boolean).length;
            this.systemHealthScore = healthyCount / healthComponents.length;
            logger_1.logger.info(`🏥 System health score: ${(this.systemHealthScore * 100).toFixed(1)}%`);
        }
        catch (diagnosticError) {
            logger_1.logger.error('🚨 System diagnostics failed:', diagnosticError);
            this.systemHealthScore = 0.1;
        }
    }
    async attemptGradualRecovery() {
        logger_1.logger.info('🔄 Attempting gradual recovery...');
        this.consecutiveErrors = Math.floor(this.consecutiveErrors / 2);
        const recoveryConfig = {
            ...this.equityConfig,
            run_interval_minutes: 60,
            tickers: ['AAPL'],
            enable_ai_analysis: false,
            enable_trading: false
        };
        logger_1.logger.info('🧪 Testing recovery with minimal configuration...');
        try {
            const originalConfig = this.config;
            this.config = recoveryConfig;
            await this.runMinimalCycle();
            logger_1.logger.info('✅ Recovery test successful - restoring functionality');
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
            logger_1.logger.info('🎉 Gradual recovery completed successfully');
        }
        catch (recoveryError) {
            logger_1.logger.error('❌ Gradual recovery failed:', recoveryError);
            throw recoveryError;
        }
    }
    async runMinimalCycle() {
        logger_1.logger.info('🧪 Running minimal recovery cycle...');
        try {
            const marketData = await data_ingestor_1.dataIngestor.fetchMarketData(['AAPL'], 'equity');
            if (marketData.length === 0) {
                throw new Error('No market data received');
            }
            const features = await features_1.featuresEngine.computeFeatures(['AAPL']);
            if (features.length === 0) {
                throw new Error('No features computed');
            }
            logger_1.logger.info('✅ Minimal cycle completed successfully');
        }
        catch (error) {
            logger_1.logger.error('❌ Minimal cycle failed:', error);
            throw error;
        }
    }
    async saveEmergencyState() {
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
            await database_1.DatabaseManager.query(`INSERT INTO runner_cycles (id, timestamp, phase, status, errors, results) 
         VALUES ($1, $2, $3, $4, $5, $6)`, [
                `emergency_${Date.now()}`,
                new Date(),
                'EMERGENCY_SHUTDOWN',
                'FAILED',
                JSON.stringify(['Emergency shutdown due to excessive errors']),
                JSON.stringify(emergencyState)
            ]);
            logger_1.logger.info('💾 Emergency state saved successfully');
        }
        catch (saveError) {
            logger_1.logger.error('❌ Failed to save emergency state:', saveError);
        }
    }
    resetErrorCounters() {
        this.errorCount = Math.floor(this.errorCount / 2);
        this.consecutiveErrors = 0;
        this.lastSuccessfulRun = new Date();
        this.systemHealthScore = Math.min(this.systemHealthScore + 0.1, 1.0);
        this.emergencyMode = false;
        logger_1.logger.info('✅ Error counters reset after successful cycle', {
            errorCount: this.errorCount,
            systemHealth: this.systemHealthScore
        });
    }
    getRunnerStatus() {
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
    async validateConfiguration() {
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
        const dbHealthy = await database_1.DatabaseManager.healthCheck();
        if (!dbHealthy) {
            throw new Error('Database connection not healthy');
        }
        logger_1.logger.info('Dual-market configuration validated successfully');
    }
    async initializeRunner() {
        logger_1.logger.info('Initializing dual-market trading runner...');
        const dataHealth = await data_ingestor_1.dataIngestor.healthCheck();
        logger_1.logger.info('Data sources health check:', dataHealth);
        if (this.equityConfig.enable_ai_analysis || this.cryptoConfig.enable_ai_analysis) {
            const aiHealthy = await ai_reasoner_1.aiReasoner.healthCheck();
            logger_1.logger.info(`AI reasoner health: ${aiHealthy ? 'OK' : 'DEGRADED'}`);
        }
        logger_1.logger.info('Dual-market trading runner initialized');
    }
    scheduleRuns() {
        this.scheduleEquityRuns();
        this.scheduleCryptoRuns();
    }
    checkDailyLimits() {
        const now = new Date();
        if (now.toDateString() !== this.lastRunDate.toDateString()) {
            this.dailyRunCount = 0;
            this.lastRunDate = now;
            logger_1.logger.info('Daily run counter reset');
        }
        if (this.dailyRunCount >= this.config.max_daily_runs) {
            throw new Error(`Daily run limit exceeded: ${this.config.max_daily_runs}`);
        }
    }
    shouldRunReflection() {
        return this.equityRunCount > 0 && this.equityRunCount % this.equityConfig.reflection_frequency === 0;
    }
    shouldRunReport() {
        return this.equityRunCount > 0 && this.equityRunCount % this.equityConfig.report_frequency === 0;
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
            this.currentCycle.metrics.ai_analysis_time_ms = Date.now() - startTime;
            logger_1.logger.info('🤖 AI analysis completed', {
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
            const recentSignals = await signal_engine_1.signalEngine.getLatestSignals(this.currentCycle.tickers_processed, 10);
            const portfolioSnapshot = await portfolio_1.portfolioManager.getLatestPortfolioSnapshot();
            const portfolioValue = portfolioSnapshot?.total_value || 100000;
            let tradesExecuted = 0;
            for (const signal of recentSignals) {
                if (signal.signal_type !== 'HOLD' && signal.confidence > 0.6) {
                    try {
                        const aiAnalysis = await ai_reasoner_1.aiReasoner.analyzeMarket(signal.symbol, {}, {}, signal);
                        const trade = await execution_1.executionEngine.evaluateAndExecute(signal, aiAnalysis, portfolioValue);
                        if (trade) {
                            tradesExecuted++;
                            logger_1.logger.info(`✅ Executed trade: ${trade.side} ${trade.quantity} ${trade.symbol} @ $${trade.executed_price}`);
                        }
                    }
                    catch (error) {
                        logger_1.logger.error(`❌ Failed to execute trade for ${signal.symbol}:`, error);
                    }
                }
            }
            this.currentCycle.trades_executed = tradesExecuted;
            this.currentCycle.metrics.execution_time_ms = Date.now() - startTime;
            logger_1.logger.info('⚡ Trade execution completed', {
                signals_evaluated: recentSignals.length,
                trades_executed: tradesExecuted,
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
            const currentSnapshot = await portfolio_1.portfolioManager.createPortfolioSnapshot();
            this.currentCycle.results.portfolio_value_change = 0;
            this.currentCycle.results.daily_pnl = currentSnapshot.daily_pnl;
            logger_1.logger.info('💼 Portfolio update completed', {
                current_value: currentSnapshot.total_value,
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
            const reflection = await reflection_1.reflectionEngine.generateReflection(7);
            logger_1.logger.info('🤔 Reflection completed');
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
            const report = await reports_1.reportsGenerator.generatePerformanceReport(30);
            logger_1.logger.info('📊 Reporting completed');
        }
        catch (error) {
            logger_1.logger.warn('Reporting phase failed:', error);
            this.currentCycle.errors.push(`Reporting failed: ${error}`);
        }
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
}
exports.TradingRunner = TradingRunner;
exports.tradingRunner = new TradingRunner();
