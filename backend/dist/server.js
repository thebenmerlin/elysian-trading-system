"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("./utils/logger");
const database_1 = require("./utils/database");
const binance_stream_1 = require("./data/websocket/binance-stream");
const ws_server_1 = require("./realtime/websocket/ws-server");
const decision_engine_1 = require("./ai/reasoning/decision-engine");
const trading_executor_1 = require("./trading/executor/trading-executor");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 4000;
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: [
        'https://elysian-trading-system.vercel.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-elysian-key', 'Authorization']
}));
app.use((0, morgan_1.default)('combined', {
    stream: { write: (message) => logger_1.logger.info(message.trim()) }
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/', limiter);
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-elysian-key'] || req.query.api_key;
    const validKey = process.env.ELYSIAN_API_KEY || 'elysian-demo-key';
    if (!apiKey || apiKey !== validKey) {
        return res.status(401).json({
            error: 'Invalid or missing API key',
            timestamp: new Date().toISOString()
        });
    }
    next();
};
app.get('/health', async (req, res) => {
    try {
        const dbHealthy = await database_1.DatabaseManager.healthCheck();
        const wsConnected = binance_stream_1.binanceStream.getConnectionStatus();
        res.json({
            status: dbHealthy && wsConnected ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            version: '2.0.0-autonomous',
            uptime: process.uptime(),
            database: dbHealthy ? 'connected' : 'disconnected',
            websocket: wsConnected ? 'connected' : 'disconnected',
            ws_clients: ws_server_1.wsServer.getClientCount(),
            environment: process.env.NODE_ENV || 'development'
        });
    }
    catch (error) {
        logger_1.logger.error('Health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
app.get('/api/assets/live', validateApiKey, async (req, res) => {
    try {
        const assetType = req.query.type;
        let query = `
      SELECT symbol, asset_type, price, volume, change_24h, last_updated, data_source
      FROM assets_live
      WHERE last_updated > NOW() - INTERVAL '5 minutes'
    `;
        const params = [];
        if (assetType && ['crypto', 'equity'].includes(assetType)) {
            query += ' AND asset_type = $1';
            params.push(assetType);
        }
        query += ' ORDER BY asset_type, symbol';
        const result = await database_1.DatabaseManager.query(query, params);
        res.json({
            data: result.rows.map(row => ({
                symbol: row.symbol,
                asset_type: row.asset_type,
                price: parseFloat(row.price),
                volume: parseFloat(row.volume || 0),
                change_24h: parseFloat(row.change_24h || 0),
                last_updated: row.last_updated,
                data_source: row.data_source
            })),
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Assets endpoint error:', error);
        res.status(500).json({
            error: 'Failed to fetch asset prices',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
app.get('/api/signals/recent', validateApiKey, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const query = `
      SELECT s.*, a.price as current_price
      FROM ai_signals s
      LEFT JOIN assets_live a ON s.symbol = a.symbol AND s.asset_type = a.asset_type
      ORDER BY s.timestamp DESC
      LIMIT $1
    `;
        const result = await database_1.DatabaseManager.query(query, [limit]);
        res.json({
            data: result.rows.map(row => ({
                id: row.id,
                symbol: row.symbol,
                asset_type: row.asset_type,
                signal_type: row.signal_type,
                confidence: parseFloat(row.confidence),
                reasoning: row.reasoning,
                price_at_signal: parseFloat(row.price_at_signal),
                current_price: parseFloat(row.current_price || row.price_at_signal),
                timestamp: row.timestamp,
                executed: row.executed
            })),
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Signals endpoint error:', error);
        res.status(500).json({
            error: 'Failed to fetch signals',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
app.get('/api/trades/recent', validateApiKey, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const query = `
      SELECT * FROM trades_executed
      ORDER BY timestamp DESC
      LIMIT $1
    `;
        const result = await database_1.DatabaseManager.query(query, [limit]);
        res.json({
            data: result.rows.map(row => ({
                id: row.id,
                symbol: row.symbol,
                asset_type: row.asset_type,
                side: row.side,
                quantity: parseFloat(row.quantity),
                price: parseFloat(row.price),
                total_value: parseFloat(row.total_value),
                reasoning: row.reasoning,
                confidence: parseFloat(row.confidence),
                pnl_realized: parseFloat(row.pnl_realized || 0),
                timestamp: row.timestamp
            })),
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Trades endpoint error:', error);
        res.status(500).json({
            error: 'Failed to fetch trades',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
app.get('/api/portfolio/live', validateApiKey, async (req, res) => {
    try {
        const positionsQuery = `
      SELECT * FROM portfolio_live
      ORDER BY market_value DESC
    `;
        const positionsResult = await database_1.DatabaseManager.query(positionsQuery);
        const initialCash = 100000;
        const cashQuery = `
      SELECT COALESCE(SUM(
        CASE 
          WHEN side = 'BUY' THEN -total_value
          WHEN side = 'SELL' THEN total_value
        END
      ), 0) as net_cash_flow
      FROM trades_executed
    `;
        const cashResult = await database_1.DatabaseManager.query(cashQuery);
        const cashBalance = initialCash + parseFloat(cashResult.rows[0].net_cash_flow || 0);
        const totalPositionValue = positionsResult.rows.reduce((sum, pos) => sum + parseFloat(pos.market_value || 0), 0);
        const totalValue = cashBalance + totalPositionValue;
        const totalPnL = totalValue - initialCash;
        const pnlQuery = `
      SELECT COALESCE(SUM(pnl_realized), 0) as realized_pnl
      FROM trades_executed
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `;
        const pnlResult = await database_1.DatabaseManager.query(pnlQuery);
        const dailyPnL = parseFloat(pnlResult.rows[0].realized_pnl || 0);
        res.json({
            data: {
                total_value: totalValue,
                cash_balance: cashBalance,
                positions_value: totalPositionValue,
                total_pnl: totalPnL,
                daily_pnl: dailyPnL,
                positions_count: positionsResult.rows.length,
                positions: positionsResult.rows.map(row => ({
                    symbol: row.symbol,
                    asset_type: row.asset_type,
                    quantity: parseFloat(row.quantity),
                    avg_price: parseFloat(row.avg_price),
                    current_price: parseFloat(row.current_price || row.avg_price),
                    market_value: parseFloat(row.market_value || 0),
                    unrealized_pnl: parseFloat(row.unrealized_pnl || 0),
                    last_updated: row.last_updated
                }))
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Portfolio endpoint error:', error);
        res.status(500).json({
            error: 'Failed to fetch portfolio',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
app.get('/api/system/events', validateApiKey, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const severity = req.query.severity;
        let query = `
      SELECT * FROM system_events
    `;
        const params = [];
        if (severity && ['INFO', 'WARN', 'ERROR'].includes(severity)) {
            query += ' WHERE severity = $1';
            params.push(severity);
        }
        query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
        params.push(limit);
        const result = await database_1.DatabaseManager.query(query, params);
        res.json({
            data: result.rows,
            count: result.rows.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('System events endpoint error:', error);
        res.status(500).json({
            error: 'Failed to fetch system events',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
app.post('/api/trade/manual', validateApiKey, async (req, res) => {
    try {
        const { symbol, asset_type, signal_type, reasoning } = req.body;
        if (!symbol || !asset_type || !signal_type) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['symbol', 'asset_type', 'signal_type']
            });
        }
        const manualSignal = {
            symbol,
            asset_type,
            signal_type,
            confidence: 0.8,
            reasoning: reasoning || 'Manual trade execution',
            features: {},
            price_at_signal: 0
        };
        const trade = await trading_executor_1.tradeExecutor.executeSignal(manualSignal);
        if (trade) {
            res.json({
                success: true,
                trade,
                message: 'Manual trade executed successfully',
                timestamp: new Date().toISOString()
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Trade execution failed or was rejected by risk management',
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Manual trade error:', error);
        res.status(500).json({
            error: 'Failed to execute manual trade',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
app.get('/', (req, res) => {
    res.json({
        name: 'Elysian Autonomous Trading System',
        version: '2.0.0-autonomous',
        status: 'running',
        features: [
            'Real-time WebSocket data feeds',
            'AI-powered signal generation',
            'Autonomous trade execution',
            'Multi-asset portfolio management',
            'Risk management system'
        ],
        timestamp: new Date().toISOString()
    });
});
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `${req.method} ${req.originalUrl} does not exist`,
        timestamp: new Date().toISOString()
    });
});
app.use((error, req, res, next) => {
    logger_1.logger.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});
async function startAutonomousSystem() {
    try {
        logger_1.logger.info('🚀 Starting Elysian Autonomous Trading System...');
        await database_1.DatabaseManager.initialize();
        logger_1.logger.info('✅ Database connected');
        ws_server_1.wsServer.initialize(server);
        logger_1.logger.info('✅ WebSocket server initialized');
        await binance_stream_1.binanceStream.start();
        logger_1.logger.info('✅ Binance WebSocket stream started');
        binance_stream_1.binanceStream.on('tick', (tick) => {
            ws_server_1.wsServer.broadcastPriceUpdate(tick.symbol, tick.price, 'crypto');
        });
        await decision_engine_1.aiDecisionEngine.start();
        logger_1.logger.info('✅ AI Decision Engine started');
        decision_engine_1.aiDecisionEngine.on('signal', async (signal) => {
            ws_server_1.wsServer.broadcastSignalGenerated(signal);
            if (signal.confidence > 0.7) {
                const trade = await trading_executor_1.tradeExecutor.executeSignal(signal);
                if (trade) {
                    ws_server_1.wsServer.broadcastTradeExecuted(trade);
                }
            }
        });
        trading_executor_1.tradeExecutor.on('trade_executed', (trade) => {
            ws_server_1.wsServer.broadcastTradeExecuted(trade);
        });
        setInterval(async () => {
            try {
                const portfolioQuery = `
          UPDATE portfolio_live 
          SET 
            current_price = al.price,
            market_value = portfolio_live.quantity * al.price,
            unrealized_pnl = (al.price - portfolio_live.avg_price) * portfolio_live.quantity,
            last_updated = NOW()
          FROM assets_live al
          WHERE portfolio_live.symbol = al.symbol 
            AND portfolio_live.asset_type = al.asset_type
        `;
                await database_1.DatabaseManager.query(portfolioQuery);
                ws_server_1.wsServer.broadcastSystemEvent({
                    type: 'portfolio_updated',
                    message: 'Portfolio values updated'
                });
            }
            catch (error) {
                logger_1.logger.error('Portfolio monitoring error:', error);
            }
        }, 5 * 60 * 1000);
        logger_1.logger.info('🎯 Autonomous trading system fully operational');
    }
    catch (error) {
        logger_1.logger.error('❌ Failed to start autonomous system:', error);
        process.exit(1);
    }
}
server.listen(PORT, async () => {
    logger_1.logger.info(`🌐 Server running on port ${PORT}`);
    logger_1.logger.info(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
    await startAutonomousSystem();
});
process.on('SIGINT', async () => {
    logger_1.logger.info('🛑 Shutting down gracefully...');
    await decision_engine_1.aiDecisionEngine.stop();
    await binance_stream_1.binanceStream.stop();
    ws_server_1.wsServer.close();
    process.exit(0);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
exports.default = app;
