"use strict";
/**
 * Elysian Trading System - Main Server
 * Express.js server with all API routes and middleware
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("./utils/logger");
const database_1 = require("./utils/database");
const runner_1 = require("./runner");
const envCheck_1 = require("./utils/envCheck");
// Import API routes
const portfolio_1 = __importDefault(require("./api/routes/portfolio"));
const trades_1 = __importDefault(require("./api/routes/trades"));
const reports_1 = __importDefault(require("./api/routes/reports"));
const reflections_1 = __importDefault(require("./api/routes/reflections"));
const internal_1 = __importDefault(require("./api/routes/internal"));
// Load environment variables
dotenv_1.default.config();
// Validate environment variables
(0, envCheck_1.validateEnvironment)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Rate limiting middleware
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 50, // limit each IP to 50 requests per windowMs
    message: {
        error: 'Too many requests from this IP',
        message: 'Please try again later',
        retryAfter: '1 minute'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
// Global middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL || 'https://elysian-frontend.vercel.app']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use((0, morgan_1.default)('combined', { stream: { write: (message) => logger_1.logger.info(message.trim()) } }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Apply rate limiting to API routes only
app.use('/api/', limiter);
app.use('/internal/', limiter);
// API key validation middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-elysian-key'] || req.query.api_key;
    const validKey = process.env.ELYSIAN_API_KEY || 'elysian-demo-key';
    if (apiKey !== validKey) {
        return res.status(401).json({
            error: 'Invalid API key',
            message: 'Please provide a valid x-elysian-key header',
            timestamp: new Date().toISOString()
        });
    }
    next();
};
// Request logging middleware
app.use((req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger_1.logger.info(`${req.method} ${req.path}`, {
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
    });
    next();
});
// Health check route (no auth required)
app.get('/health', async (req, res) => {
    try {
        const dbHealthy = await database_1.DatabaseManager.healthCheck();
        res.json({
            status: dbHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: process.uptime(),
            database: dbHealthy ? 'connected' : 'disconnected'
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// API Routes with authentication
app.use('/api/portfolio', validateApiKey, portfolio_1.default);
app.use('/api/trades', validateApiKey, trades_1.default);
app.use('/api/reports', validateApiKey, reports_1.default);
app.use('/api/reflections', validateApiKey, reflections_1.default);
app.use('/internal', validateApiKey, internal_1.default);
// Default route
app.get('/', (req, res) => {
    res.json({
        name: 'Elysian Trading System',
        version: '1.0.0',
        description: 'Autonomous AI-Powered Hedge Fund Simulator',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            health: '/health',
            portfolio: '/api/portfolio',
            trades: '/api/trades',
            reports: '/api/reports',
            reflections: '/api/reflections',
            internal: '/internal'
        }
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
        timestamp: new Date().toISOString()
    });
});
// Error handling middleware
app.use((error, req, res, next) => {
    logger_1.logger.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});
// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger_1.logger.info(`Received ${signal}. Starting graceful shutdown...`);
    try {
        // Stop trading runner
        await runner_1.tradingRunner.stopRunner();
        // Close database connections
        await database_1.DatabaseManager.close();
        logger_1.logger.info('Graceful shutdown completed');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Start server
const startServer = async () => {
    try {
        // Initialize database
        logger_1.logger.info('Initializing database connection...');
        await database_1.DatabaseManager.initialize();
        // Start server
        app.listen(PORT, () => {
            logger_1.logger.info(`🚀 Elysian Trading System started`);
            logger_1.logger.info(`📡 Server running on port ${PORT}`);
            logger_1.logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
            logger_1.logger.info(`💰 Live Trading: ${process.env.ELYSIAN_LIVE === 'true' ? 'ENABLED' : 'PAPER MODE'}`);
            // Auto-start trading runner if configured
            if (process.env.AUTO_START_RUNNER === 'true') {
                setTimeout(async () => {
                    try {
                        logger_1.logger.info('Auto-starting trading runner...');
                        await runner_1.tradingRunner.startRunner();
                    }
                    catch (error) {
                        logger_1.logger.error('Failed to auto-start trading runner:', error);
                    }
                }, 5000);
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
};
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
startServer();
exports.default = app;
