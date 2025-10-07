/// <reference types="node" />

/**
 * Elysian Trading System - Main Server
 * Express.js server with all API routes and middleware
 */

import * as process from 'process';
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

// Import API routes
import portfolioRoutes from './api/routes/portfolio';
import tradesRoutes from './api/routes/trades';
import reportsRoutes from './api/routes/reports';
import reflectionsRoutes from './api/routes/reflections';
import internalRoutes from './api/routes/internal';

// Load environment variables
dotenv.config();

// Validate environment variables
validateEnvironment();

const app = express();
const PORT = process.env.PORT || 4000;

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // limit each IP to 50 requests per windowMs
  message: {
    error: 'Too many requests from this IP',
    message: 'Please try again later',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Global middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL || 'https://elysian-frontend.vercel.app']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(morgan('combined', { stream: { write: (message: string) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to API routes only
app.use('/api/', limiter);
app.use('/internal/', limiter);

// API key validation middleware
const validateApiKey = (req: any, res: any, next: any) => {
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
app.use((req: any, res: any, next: any) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  next();
});

// Health check route (no auth required)
app.get('/health', async (req: any, res: any) => {
  try {
    const dbHealthy = await DatabaseManager.healthCheck();
    res.json({
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      database: dbHealthy ? 'connected' : 'disconnected'
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes with authentication
app.use('/api/portfolio', validateApiKey, portfolioRoutes);
app.use('/api/trades', validateApiKey, tradesRoutes);
app.use('/api/reports', validateApiKey, reportsRoutes);
app.use('/api/reflections', validateApiKey, reflectionsRoutes);
app.use('/internal', validateApiKey, internalRoutes);

// Default route
app.get('/', (req: any, res: any) => {
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
app.use('*', (req: any, res: any) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
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

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop trading runner
    await tradingRunner.stopRunner();
    
    // Close database connections
    await DatabaseManager.close();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Initialize database
    logger.info('Initializing database connection...');
    await DatabaseManager.initialize();
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Elysian Trading System started`);
      logger.info(`📡 Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
      logger.info(`💰 Live Trading: ${process.env.ELYSIAN_LIVE === 'true' ? 'ENABLED' : 'PAPER MODE'}`);
      
      // Auto-start trading runner if configured
      if (process.env.AUTO_START_RUNNER === 'true') {
        setTimeout(async () => {
          try {
            logger.info('Auto-starting trading runner...');
            await tradingRunner.startRunner();
          } catch (error) {
            logger.error('Failed to auto-start trading runner:', error);
          }
        }, 5000);
      }
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error: any) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

export default app;
