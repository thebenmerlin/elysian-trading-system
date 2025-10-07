"use strict";
/**
 * Elysian Trading System - Main API Server
 * AI-Powered Autonomous Trading Platform
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = require("dotenv");
const logger_1 = require("@/utils/logger");
const errorHandler_1 = require("@/utils/errorHandler");
const database_1 = require("@/utils/database");
// Route imports
const portfolio_1 = __importDefault(require("./routes/portfolio"));
const trades_1 = __importDefault(require("./routes/trades"));
const reports_1 = __importDefault(require("./routes/reports"));
const internal_1 = __importDefault(require("./routes/internal"));
const reflections_1 = __importDefault(require("./routes/reflections"));
(0, dotenv_1.config)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT || 1000,
    message: { error: 'Too many requests from this IP' }
});
app.use(limiter);
// Body parsing
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Logging middleware
app.use((req, res, next) => {
    logger_1.logger.info('API Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});
// API key authentication middleware
app.use('/api', (req, res, next) => {
    const apiKey = req.header('x-elysian-key') || req.query.api_key;
    const expectedKey = process.env.ELYSIAN_API_KEY;
    if (!expectedKey) {
        logger_1.logger.warn('ELYSIAN_API_KEY not configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }
    if (!apiKey || apiKey !== expectedKey) {
        logger_1.logger.warn('Invalid API key attempt', { ip: req.ip });
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    next();
});
// Health check (no auth required)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });
});
// API Routes
app.use('/api/portfolio', portfolio_1.default);
app.use('/api/trades', trades_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/reflections', reflections_1.default);
app.use('/internal', internal_1.default);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// Error handler
app.use(errorHandler_1.errorHandler);
// Database connection and server start
async function startServer() {
    try {
        // Initialize database
        await database_1.DatabaseManager.initialize();
        logger_1.logger.info('Database connected successfully');
        // Start server
        app.listen(PORT, () => {
            logger_1.logger.info(`🚀 Elysian Trading System API started`, {
                port: PORT,
                environment: process.env.NODE_ENV,
                timestamp: new Date().toISOString()
            });
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGINT', async () => {
    logger_1.logger.info('Received SIGINT, shutting down gracefully');
    await database_1.DatabaseManager.close();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logger_1.logger.info('Received SIGTERM, shutting down gracefully');
    await database_1.DatabaseManager.close();
    process.exit(0);
});
if (require.main === module) {
    startServer();
}
exports.default = app;
