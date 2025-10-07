/**
 * Elysian Trading System - Portfolio API Routes
 */
import { Router } from 'express';
import { logger } from '../../utils/logger';
import { portfolioManager } from '../../portfolio';

const router = Router();

// Get current portfolio snapshot
router.get('/', async (req, res) => {
  try {
    const snapshot = await portfolioManager.getLatestPortfolioSnapshot();
    
    if (!snapshot) {
      return res.status(404).json({
        error: 'No portfolio data found',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      data: snapshot,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get portfolio snapshot:', error);
    res.status(500).json({
      error: 'Failed to retrieve portfolio data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get portfolio history
router.get('/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    if (days < 1 || days > 365) {
      return res.status(400).json({
        error: 'Days parameter must be between 1 and 365',
        timestamp: new Date().toISOString()
      });
    }
    
    const history = await portfolioManager.getPortfolioHistory(days);
    
    res.json({
      data: history,
      period: {
        days,
        count: history.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get portfolio history:', error);
    res.status(500).json({
      error: 'Failed to retrieve portfolio history',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get portfolio metrics
router.get('/metrics', async (req, res) => {
  try {
    const snapshot = await portfolioManager.getLatestPortfolioSnapshot();
    
    if (!snapshot) {
      return res.status(404).json({
        error: 'No portfolio data found',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      data: {
        current_value: snapshot.total_value,
        total_pnl: snapshot.total_pnl,
        daily_pnl: snapshot.daily_pnl,
        metrics: snapshot.metrics,
        allocation: snapshot.allocation,
        positions_count: snapshot.positions.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get portfolio metrics:', error);
    res.status(500).json({
      error: 'Failed to retrieve portfolio metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
