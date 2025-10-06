/**
 * Elysian Trading System - Main API Server
 * AI-Powered Autonomous Trading Platform
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/utils/errorHandler';
import { DatabaseManager } from '@/utils/database';

// Route imports
import portfolioRoutes from './routes/portfolio';
import tradesRoutes from './routes/trades';
import reportsRoutes from './routes/reports';
import internalRoutes from './routes/internal';
import reflectionsRoutes from './routes/reflections';

config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT || 1000,
  message: { error: 'Too many requests from this IP' }
});
app.use(limiter);

// Body parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  logger.info('API Request', {
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
    logger.warn('ELYSIAN_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!apiKey || apiKey !== expectedKey) {
    logger.warn('Invalid API key attempt', { ip: req.ip });
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
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/reflections', reflectionsRoutes);
app.use('/internal', internalRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use(errorHandler);

// Database connection and server start
async function startServer() {
  try {
    // Initialize database
    await DatabaseManager.initialize();
    logger.info('Database connected successfully');

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Elysian Trading System API started`, {
        port: PORT,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await DatabaseManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await DatabaseManager.close();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

export default app;
