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
import { dataIngestor } from './data_ingestor'; // ✅ MISSING IMPORT ADDED
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
app.get('/test-auth', validateApiKey, (req: any, res: any) => {
  res.json({
    message: 'Authentication successful',
    timestamp: new Date().toISOString(),
    authenticated: true
  });
});

// Health check route (no auth required)
app.get('/health', async (req: any, res: any) => {
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
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint for troubleshooting
app.get('/debug', (req: any, res: any) => {
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

// PORTFOLIO ROUTES
app.get('/api/portfolio', validateApiKey, async (req: any, res: any) => {
  try {
    logger.info('Portfolio endpoint called');
    
    // Create default dual-market portfolio
    const defaultPortfolio = {
      total_value: 100000,
      cash_balance: 100000,
      equity_value: 0,
      crypto_value: 0,
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

    res.json({
      data: defaultPortfolio,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Portfolio endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch portfolio',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// TRADES ROUTES
app.get('/api/trades', validateApiKey, async (req: any, res: any) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Query for recent trades with market_type
    const query = `
      SELECT * FROM trades 
      ORDER BY timestamp DESC 
      LIMIT $1
    `;
    
    try {
      const result = await DatabaseManager.query(query, [limit]);
      res.json({
        data: result.rows,
        total_count: result.rows.length,
        limit: limit,
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      // Return empty array if table doesn't exist yet
      res.json({
        data: [],
        total_count: 0,
        limit: limit,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    logger.error('Trades endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch trades',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// CRYPTO ROUTES
app.get('/api/crypto/latest', validateApiKey, async (req: any, res: any) => {
  try {
    logger.info('Crypto latest data endpoint called');
    
    const query = `
      SELECT DISTINCT ON (symbol) 
        symbol, timestamp, open, high, low, close, volume, provider, market_type,
        (close - open) / open * 100 as change_24h
      FROM market_data 
      WHERE market_type = 'crypto'
        AND timestamp >= NOW() - INTERVAL '24 hours'
      ORDER BY symbol, timestamp DESC
      LIMIT 10
    `;
    
    try {
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
        change_24h: parseFloat(row.change_24h || 0)
      }));

      res.json({
        data: cryptoData,
        timestamp: new Date().toISOString(),
        count: cryptoData.length
      });
    } catch (dbError) {
      // Return mock crypto data if table doesn't exist
      const mockCryptoData = [
        { symbol: 'BTCUSDT', close: 43250.50, change_24h: 2.35, market_type: 'crypto' },
        { symbol: 'ETHUSDT', close: 2341.25, change_24h: -1.22, market_type: 'crypto' },
        { symbol: 'ADAUSDT', close: 0.4523, change_24h: 0.85, market_type: 'crypto' }
      ];
      
      res.json({
        data: mockCryptoData,
        timestamp: new Date().toISOString(),
        count: mockCryptoData.length
      });
    }
    
  } catch (error) {
    logger.error('Crypto latest endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch crypto data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/crypto/pairs', validateApiKey, async (req: any, res: any) => {
  try {
    const query = `SELECT * FROM crypto_pairs WHERE is_active = true ORDER BY symbol`;
    
    try {
      const result = await DatabaseManager.query(query);
      res.json({
        data: result.rows,
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      // Return default pairs if table doesn't exist
      const defaultPairs = [
        { symbol: 'BTCUSDT', base_asset: 'BTC', quote_asset: 'USDT', is_active: true },
        { symbol: 'ETHUSDT', base_asset: 'ETH', quote_asset: 'USDT', is_active: true },
        { symbol: 'ADAUSDT', base_asset: 'ADA', quote_asset: 'USDT', is_active: true }
      ];
      
      res.json({
        data: defaultPairs,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    logger.error('Crypto pairs endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch crypto pairs',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/market/status', validateApiKey, async (req: any, res: any) => {
  try {
    let equityOpen = false;
    
    try {
      equityOpen = await dataIngestor.isMarketOpen('equity');
    } catch (error) {
      logger.warn('Failed to check market status:', error);
      // Default market hours check
      const now = new Date();
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const utcTime = utcHours * 60 + utcMinutes;
      const marketOpen = 14 * 60 + 30; // 14:30 UTC
      const marketClose = 21 * 60; // 21:00 UTC
      const isWeekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
      equityOpen = isWeekday && utcTime >= marketOpen && utcTime <= marketClose;
    }
    
    res.json({
      data: {
        equity: {
          is_open: equityOpen,
          market_type: 'equity',
          timezone: 'America/New_York',
          trading_hours: '9:30 AM - 4:00 PM EST'
        },
        crypto: {
          is_open: true,
          market_type: 'crypto',
          timezone: 'UTC',
          trading_hours: '24/7'
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Market status endpoint error:', error);
    res.status(500).json({
      error: 'Failed to get market status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// REFLECTIONS ROUTES
app.get('/api/reflections/latest', validateApiKey, async (req: any, res: any) => {
  try {
    // Return empty reflection for now
    res.json({
      data: null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Reflections endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch reflections',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// INTERNAL/SYSTEM ROUTES (Updated for dual-market)
app.get('/internal/runner/status', validateApiKey, async (req: any, res: any) => {
  try {
    const status = tradingRunner.getRunnerStatus();
    
    res.json({
      data: {
        is_running: status.is_running,
        run_count: status.run_count,
        daily_run_count: status.daily_run_count,
        current_cycle: status.current_cycle,
        equity_config: status.equity_config || {
          tickers: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA'],
          run_interval_minutes: 15,
          enable_trading: false,
          enable_ai_analysis: true
        },
        crypto_config: status.crypto_config || {
          tickers: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'],
          run_interval_minutes: 5,
          enable_trading: false,
          enable_ai_analysis: true
        },
        last_equity_run: status.last_equity_run || new Date(),
        last_crypto_run: status.last_crypto_run || new Date(),
        equity_run_count: status.equity_run_count || 0,
        crypto_run_count: status.crypto_run_count || 0,
        system_health: status.system_health || 1.0,
        market_status: {
          equity_open: false, // Will be updated by market status check
          crypto_open: true
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Runner status endpoint error:', error);
    res.status(500).json({
      error: 'Failed to get runner status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/internal/runner/start', validateApiKey, async (req: any, res: any) => {
  try {
    await tradingRunner.startRunner();
    res.json({
      data: { message: 'Dual-market runner started successfully', status: 'running' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Runner start endpoint error:', error);
    res.status(500).json({
      error: 'Failed to start runner',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/internal/runner/stop', validateApiKey, async (req: any, res: any) => {
  try {
    await tradingRunner.stopRunner();
    res.json({
      data: { message: 'Dual-market runner stopped successfully', status: 'stopped' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Runner stop endpoint error:', error);
    res.status(500).json({
      error: 'Failed to stop runner',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/internal/runner/cycle', validateApiKey, async (req: any, res: any) => {
  try {
    const cycle = await tradingRunner.runSingleCycle();
    res.json({
      data: { 
        message: 'Trading cycle executed successfully', 
        cycle_id: cycle.id,
        market_type: cycle.market_type,
        signals_generated: cycle.signals_generated,
        trades_executed: cycle.trades_executed,
        status: cycle.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Runner cycle endpoint error:', error);
    res.status(500).json({
      error: 'Failed to run cycle',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Default route
app.get('/', (req: any, res: any) => {
  res.json({
    name: 'Elysian Dual-Market Trading System',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    markets: ['equity', 'crypto'],
    endpoints: {
      health: '/health',
      debug: '/debug',
      portfolio: '/api/portfolio',
      trades: '/api/trades',
      crypto_latest: '/api/crypto/latest',
      crypto_pairs: '/api/crypto/pairs',
      market_status: '/api/market/status',
      reflections: '/api/reflections/latest',
      runner_status: '/internal/runner/status'
    }
  });
});

// 404 handler
app.use('*', (req: any, res: any) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    available_routes: [
      '/health', 
      '/api/portfolio', 
      '/api/trades', 
      '/api/crypto/latest',
      '/api/market/status',
      '/internal/runner/status'
    ],
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start server with dual-market auto-start
const startServer = async () => {
  try {
    // Initialize database connection
    logger.info('Initializing database connection...');
    await DatabaseManager.initialize();

    // DUAL-MARKET AUTO-START LOGIC
    if (process.env.AUTO_START_RUNNER === 'true') {
      logger.info('🚀 Auto-starting dual-market trading runner...');
      
      setTimeout(async () => {
        try {
          await tradingRunner.startDualMarketRunner();
          logger.info('✅ Dual-market trading runner auto-started successfully');
        } catch (error) {
          logger.error('❌ Failed to auto-start dual-market runner:', error);
        }
      }, 10000);
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Elysian Dual-Market Trading System started`);
      logger.info(`📡 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`💰 Live Trading: ${process.env.ELYSIAN_LIVE === 'true' ? 'ENABLED' : 'PAPER MODE'}`);
      logger.info(`🤖 Auto-start: ${process.env.AUTO_START_RUNNER === 'true' ? 'ENABLED' : 'DISABLED'}`);
      logger.info(`📈 Equity Tickers: ${process.env.RUNNER_TICKERS || 'AAPL,MSFT,GOOGL,NVDA,TSLA'}`);
      logger.info(`🪙 Crypto Tickers: ${process.env.CRYPTO_TICKERS || 'BTCUSDT,ETHUSDT,ADAUSDT,DOTUSDT,LINKUSDT'}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error: any) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

export default app;
