/**
 * Elysian Trading System - Main Server (Dual-Market)
 * Express.js server with all API routes, middleware, and crypto endpoints
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { DatabaseManager } from './utils/database';
import { tradingRunner } from './runner';
import { validateEnvironment } from './utils/envCheck';

// Load environment variables
dotenv.config();

// Validate environment variables
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 4000;

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Global middleware
app.use(helmet());
app.use(cors({
  origin: [
    'https://elysian-trading-system.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-elysian-key', 'Authorization']
}));
app.use(morgan('combined', { stream: { write: (message: any) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting
app.use('/api/', limiter);
app.use('/internal/', limiter);

// API key validation middleware
const validateApiKey = (req: any, res: any, next: any) => {
  const apiKey = req.headers['x-elysian-key'] || req.query.api_key;
  const validKey = process.env.ELYSIAN_API_KEY || 'elysian-demo-key';

  console.log('🔑 API Key Validation:', {
    received: apiKey ? `${apiKey.substring(0,4)}...` : 'NONE',
    expected: validKey ? `${validKey.substring(0,4)}...` : 'NONE',
    match: apiKey === validKey,
    timestamp: new Date().toISOString()
  });

  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key',
      message: 'Please provide x-elysian-key header or api_key query parameter',
      timestamp: new Date().toISOString()
    });
  }
  if (apiKey !== validKey) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'API key does not match expected value',
      received_key: apiKey ? `${apiKey.substring(0,4)}...` : 'NONE',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Test endpoint for debugging
app.get('/test-auth', validateApiKey, (_req, res) => {
  res.json({
    message: 'Authentication successful',
    timestamp: new Date().toISOString(),
    authenticated: true
  });
});

// Health check route (no auth)
app.get('/health', async (_req, res) => {
  try {
    const dbHealthy = await DatabaseManager.healthCheck();
    res.json({
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      uptime: process.uptime(),
      database: dbHealthy ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error: any) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint
app.get('/debug', (_req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database_url_set: !!process.env.DATABASE_URL,
    api_key_set: !!process.env.ELYSIAN_API_KEY,
    routes_available: [
      'GET /health',
      'GET /debug',
      'GET /api/portfolio',
      'GET /api/crypto/latest',
      'GET /api/market/status',
      'GET /internal/runner/status'
    ]
  });
});

// PORTFOLIO ROUTE
app.get('/api/portfolio', validateApiKey, async (_req, res) => {
  try {
    logger.info('Portfolio endpoint called');
    const defaultPortfolio = {
      total_value: 100000,
      equity_value: 50000,
      crypto_value: 50000,
      cash_balance: 100000,
      invested_amount: 0,
      daily_pnl: 0,
      total_pnl: 0,
      positions_count: 0,
      last_updated: new Date().toISOString(),
      metrics: {
        total_return_pct: 0,
        sharpe_ratio: 0,
        max_drawdown_pct: 0,
        win_rate: 0
      }
    };
    res.json({ data: defaultPortfolio, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Portfolio endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch portfolio',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// CRYPTO LATEST DATA
app.get('/api/crypto/latest', validateApiKey, async (_req, res) => {
  try {
    logger.info('Crypto latest data endpoint called');
    const query = `
      SELECT DISTINCT ON (symbol) 
        symbol, timestamp, open, high, low, close, volume, provider, market_type,
        ((close - open)/open)*100 AS change_24h
      FROM market_data
      WHERE market_type = 'crypto'
        AND timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY symbol, timestamp DESC
      LIMIT 10`;
    const result = await DatabaseManager.query(query);
    const cryptoData = result.rows.map((row: any) => ({
      symbol: row.symbol,
      timestamp: row.timestamp,
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseInt(row.volume),
      provider: row.provider,
      market_type: row.market_type,
      change_24h: parseFloat(row.change_24h)
    }));
    res.json({ data: cryptoData, timestamp: new Date().toISOString(), count: cryptoData.length });
  } catch (error) {
    logger.error('Crypto latest endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch crypto data',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// MARKET STATUS
app.get('/api/market/status', validateApiKey, async (_req, res) => {
  try {
    const equityOpen = await dataIngestor.isMarketOpen('equity');
    res.json({
      data: {
        equity: {
          is_open: equityOpen,
          market_type: 'equity',
          trading_hours: '9:30 AM - 4:00 PM EST'
        },
        crypto: {
          is_open: true,
          market_type: 'crypto',
          trading_hours: '24/7'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Market status endpoint error:', error);
    res.status(500).json({
      error: 'Failed to get market status',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// INTERNAL RUNNER STATUS
app.get('/internal/runner/status', validateApiKey, async (_req, res) => {
  try {
    const status = tradingRunner.getRunnerStatus();
    res.json({ data: status, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Runner status endpoint error:', error);
    res.status(500).json({
      error: 'Failed to get runner status',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// START RUNNER
app.post('/internal/runner/start', validateApiKey, async (_req, res) => {
  try {
    await tradingRunner.startRunner();
    res.json({ data: { message: 'Runner start command received', status: 'starting' }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Runner start endpoint error:', error);
    res.status(500).json({
      error: 'Failed to start runner',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// STOP RUNNER
app.post('/internal/runner/stop', validateApiKey, async (_req, res) => {
  try {
    await tradingRunner.stopRunner();
    res.json({ data: { message: 'Runner stop command received', status: 'stopping' }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Runner stop endpoint error:', error);
    res.status(500).json({
      error: 'Failed to stop runner',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// RUN CYCLE
app.post('/internal/runner/cycle', validateApiKey, async (_req, res) => {
  try {
    const cycle = await tradingRunner.runSingleCycle();
    res.json({ data: { message: 'Trading cycle executed', cycle }, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Runner cycle endpoint error:', error);
    res.status(500).json({
      error: 'Failed to run cycle',
      message: (error as Error).message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Default route
app.get('/', (_req, res) => {
  res.json({
    name: 'Elysian Dual-Market Trading System',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      debug: '/debug',
      portfolio: '/api/portfolio',
      crypto_latest: '/api/crypto/latest',
      market_status: '/api/market/status',
      runner_status: '/internal/runner/status'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    available_routes: ['/health', '/api/portfolio', '/api/crypto/latest', '/api/market/status', '/internal/runner/status'],
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error: any, _req: any, res: any, _next: any) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start server with auto-start logic
const startServer = async () => {
  try {
    logger.info('Initializing database connection...');
    await DatabaseManager.initialize();

    if (process.env.AUTO_START_RUNNER === 'true') {
      logger.info('🚀 Auto-starting trading runner...');
      setTimeout(async () => {
        try {
          await tradingRunner.startRunner();
          logger.info('✅ Trading runner auto-started successfully');
        } catch (error) {
          logger.error('❌ Failed to auto-start runner:', error);
        }
      }, 10000);
    }

    app.listen(PORT, () => {
      logger.info(`🚀 Elysian Trading System started`);
      logger.info(`📡 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`💰 Live Trading: ${process.env.ELYSIAN_LIVE === 'true' ? 'ENABLED' : 'PAPER MODE'}`);
      logger.info(`🤖 Auto-start: ${process.env.AUTO_START_RUNNER === 'true' ? 'ENABLED' : 'DISABLED'}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
  }
};

// Uncaught exceptions
process.on('uncaughtException', (error: any) => logger.error('Uncaught Exception:', error));
process.on('unhandledRejection', (reason: any, promise: any) => logger.error('Unhandled Rejection at:', promise, 'reason:', reason));

startServer();

export default app;
