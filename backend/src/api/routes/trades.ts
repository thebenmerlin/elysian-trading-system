/**
 * Elysian Trading System - Trades API Routes
 */

import { Router } from 'express';
import { logger } from '@/utils/logger';
import { executionEngine } from '@/execution';

const router = Router();

// Get recent trades
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const trades = await executionEngine.getRecentTrades(limit);

    const summary = {
      total_trades: trades.length,
      buy_trades: trades.filter(t => t.side === 'BUY').length,
      sell_trades: trades.filter(t => t.side === 'SELL').length,
    };

    res.json({
      data: trades,
      summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get trades:', error);
    res.status(500).json({
      error: 'Failed to retrieve trades',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
