/**
 * Elysian Autonomous Trading System - Main Server
 */
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Core imports
import { logger } from './utils/logger';
import { DatabaseManager } from './utils/database';

// Real-time data imports
import { binanceStream } from './data/websocket/binance-stream';
import { wsServer } from './realtime/websocket/ws-server';

// AI and trading imports
import { aiDecisionEngine } from './ai/reasoning/decision-engine';
import { tradeExecutor } from './trading/executor/trading-executor';

// Load environment
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 4000;

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200, // Increased for WebSocket connections
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
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

app.use(morgan('combined', { 
  stream: { write: (message: any) => logger.info(message.trim()) } 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', limiter);

// API key validation
const validateApiKey = (req: any, res: any, next: any) => {
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

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbHealthy = await DatabaseManager.healthCheck();
    const wsConnected = binanceStream.getConnectionStatus();
    
    res.json({
      status: dbHealthy && wsConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.0.0-autonomous',
      uptime: process.uptime(),
      database: dbHealthy ? 'connected' : 'disconnected',
      websocket: wsConnected ? 'connected' : 'disconnected',
      ws_clients: wsServer.getClientCount(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error: any) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Live asset prices
app.get('/api/assets/live', validateApiKey, async (req, res) => {
  try {
    const assetType = req.query.type as string;
    let query = `
      SELECT symbol, asset_type, price, volume, change_24h, last_updated, data_source
      FROM assets_live
      WHERE last_updated > NOW() - INTERVAL '5 minutes'
    `;
    
    const params: any[] = [];
    if (assetType && ['crypto', 'equity'].includes(assetType)) {
      query += ' AND asset_type = $1';
      params.push(assetType);
    }
    
    query += ' ORDER BY asset_type, symbol';
    
    const result = await DatabaseManager.query(query, params);
    
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
  } catch (error: any) {
    logger.error('Assets endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch asset prices',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Recent AI signals
app.get('/api/signals/recent', validateApiKey, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const query = `
      SELECT s.*, a.price as current_price
      FROM ai_signals s
      LEFT JOIN assets_live a ON s.symbol = a.symbol AND s.asset_type = a.asset_type
      ORDER BY s.timestamp DESC
      LIMIT $1
    `;
    
    const result = await DatabaseManager.query(query, [limit]);
    
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
  } catch (error: any) {
    logger.error('Signals endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch signals',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Recent trades
app.get('/api/trades/recent', validateApiKey, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const query = `
      SELECT * FROM trades_executed
      ORDER BY timestamp DESC
      LIMIT $1
    `;
    
    const result = await DatabaseManager.query(query, [limit]);
    
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
  } catch (error: any) {
    logger.error('Trades endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch trades',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Portfolio status
app.get('/api/portfolio/live', validateApiKey, async (req, res) => {
  try {
    // Get current positions
    const positionsQuery = `
      SELECT * FROM portfolio_live
      ORDER BY market_value DESC
    `;
    const positionsResult = await DatabaseManager.query(positionsQuery);
    
    // Get cash balance
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
    const cashResult = await DatabaseManager.query(cashQuery);
    const cashBalance = initialCash + parseFloat(cashResult.rows[0].net_cash_flow || 0);
    
    // Calculate totals
    const totalPositionValue = positionsResult.rows.reduce(
      (sum, pos) => sum + parseFloat(pos.market_value || 0), 0
    );
    const totalValue = cashBalance + totalPositionValue;
    const totalPnL = totalValue - initialCash;
    
    // Get recent PnL
    const pnlQuery = `
      SELECT COALESCE(SUM(pnl_realized), 0) as realized_pnl
      FROM trades_executed
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `;
    const pnlResult = await DatabaseManager.query(pnlQuery);
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
  } catch (error: any) {
    logger.error('Portfolio endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch portfolio',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System events
app.get('/api/system/events', validateApiKey, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const severity = req.query.severity as string;
    
    let query = `
      SELECT * FROM system_events
    `;
    const params: any[] = [];
    
    if (severity && ['INFO', 'WARN', 'ERROR'].includes(severity)) {
      query += ' WHERE severity = $1';
      params.push(severity);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await DatabaseManager.query(query, params);
    
    res.json({
      data: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('System events endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch system events',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manual trade execution (for testing)
app.post('/api/trade/manual', validateApiKey, async (req, res) => {
  try {
    const { symbol, asset_type, signal_type, reasoning } = req.body;
    
    if (!symbol || !asset_type || !signal_type) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['symbol', 'asset_type', 'signal_type']
      });
    }
    
    // Create a manual signal
    const manualSignal = {
      symbol,
      asset_type,
      signal_type,
      confidence: 0.8,
      reasoning: reasoning || 'Manual trade execution',
      features: {},
      price_at_signal: 0 // Will be fetched by executor
    };
    
    const trade = await tradeExecutor.executeSignal(manualSignal as any);
    
    if (trade) {
      res.json({
        success: true,
        trade,
        message: 'Manual trade executed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Trade execution failed or was rejected by risk management',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    logger.error('Manual trade error:', error);
    res.status(500).json({
      error: 'Failed to execute manual trade',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Default route
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

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Initialize autonomous trading system
async function startAutonomousSystem(): Promise<void> {
  try {
    logger.info('🚀 Starting Elysian Autonomous Trading System...');
    
    // Initialize database
    await DatabaseManager.initialize();
    logger.info('✅ Database connected');
    
    // Initialize WebSocket server
    wsServer.initialize(server);
    logger.info('✅ WebSocket server initialized');
    
    // Start real-time data feeds
    await binanceStream.start();
    logger.info('✅ Binance WebSocket stream started');
    
    // Connect real-time events
    binanceStream.on('tick', (tick) => {
      wsServer.broadcastPriceUpdate(tick.symbol, tick.price, 'crypto');
    });
    
    // Start AI decision engine
    await aiDecisionEngine.start();
    logger.info('✅ AI Decision Engine started');
    
    // Connect AI events
    aiDecisionEngine.on('signal', async (signal) => {
      wsServer.broadcastSignalGenerated(signal);
      
      // Auto-execute high-confidence signals
      if (signal.confidence > 0.7) {
        const trade = await tradeExecutor.executeSignal(signal);
        if (trade) {
          wsServer.broadcastTradeExecuted(trade);
        }
      }
    });
    
    // Connect trade executor events
    tradeExecutor.on('trade_executed', (trade) => {
      wsServer.broadcastTradeExecuted(trade);
    });
    
    // Start portfolio monitoring (every 5 minutes)
    setInterval(async () => {
      try {
        // Update portfolio values and broadcast
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
        await DatabaseManager.query(portfolioQuery);
        
        // Broadcast portfolio update
        wsServer.broadcastSystemEvent({
          type: 'portfolio_updated',
          message: 'Portfolio values updated'
        });
      } catch (error) {
        logger.error('Portfolio monitoring error:', error);
      }
    }, 5 * 60 * 1000);
    
    logger.info('🎯 Autonomous trading system fully operational');
    
  } catch (error) {
    logger.error('❌ Failed to start autonomous system:', error);
    process.exit(1);
  }
}

// Start server
server.listen(PORT, async () => {
  logger.info(`🌐 Server running on port ${PORT}`);
  logger.info(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start autonomous system
  await startAutonomousSystem();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Shutting down gracefully...');
  
  await aiDecisionEngine.stop();
  await binanceStream.stop();
  wsServer.close();
  
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
