"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = validateEnvironment;
const logger_1 = require("./logger");
const envConfig = {
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
};
function validateEnvironment() {
    logger_1.logger.info('Validating environment configuration...');
    const errors = [];
    for (const varName of envConfig.required) {
        const value = process.env[varName];
        if (!value || value.trim() === '') {
            errors.push(`Required environment variable ${varName} is not set`);
        }
    }
    for (const [varName, defaultValue] of Object.entries(envConfig.defaults)) {
        if (!process.env[varName]) {
            process.env[varName] = defaultValue;
            logger_1.logger.info(`Set default value for ${varName}: ${defaultValue}`);
        }
    }
    logger_1.logger.info('System Configuration Summary:');
    logger_1.logger.info(`  Environment: ${process.env.NODE_ENV}`);
    logger_1.logger.info(`  Port: ${process.env.PORT}`);
    logger_1.logger.info(`  Live Trading: ${process.env.ELYSIAN_LIVE === 'true' ? 'ENABLED' : 'PAPER MODE'}`);
    logger_1.logger.info(`  Trading Tickers: ${process.env.RUNNER_TICKERS}`);
    logger_1.logger.info(`  Initial Cash: $${Number(process.env.INITIAL_CASH).toLocaleString()}`);
    logger_1.logger.info(`  Run Interval: ${process.env.RUN_INTERVAL_MINUTES} minutes`);
    logger_1.logger.info(`  AI Analysis: ${process.env.ENABLE_AI_ANALYSIS === 'true' ? 'ENABLED' : 'DISABLED'}`);
    logger_1.logger.info(`  Auto Start: ${process.env.AUTO_START_RUNNER === 'true' ? 'YES' : 'NO'}`);
    const dbUrl = process.env.DATABASE_URL;
    const maskedDbUrl = dbUrl ?
        dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@') : 'NOT SET';
    logger_1.logger.info(`  Database: ${maskedDbUrl}`);
    const apiKey = process.env.ELYSIAN_API_KEY;
    const maskedApiKey = apiKey ?
        `${apiKey.substring(0, 4)}${'*'.repeat(Math.max(0, apiKey.length - 8))}${apiKey.substring(apiKey.length - 4)}` : 'NOT SET';
    logger_1.logger.info(`  API Key: ${maskedApiKey}`);
    if (errors.length > 0) {
        logger_1.logger.error('Environment validation failed:');
        errors.forEach(error => logger_1.logger.error(`  - ${error}`));
        logger_1.logger.error('Please set the required environment variables and restart the application.');
        process.exit(1);
    }
    logger_1.logger.info('Environment validation completed successfully');
}
