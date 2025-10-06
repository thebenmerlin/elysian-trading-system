/**
 * Elysian Trading System - Reports API Routes
 */

import { Router } from 'express';
import { logger } from '@/utils/logger';
import { reportsGenerator } from '@/reports';

const router = Router();

// Get latest performance report
router.get('/latest', async (req, res) => {
  try {
    const reports = await reportsGenerator.getLatestReports(1);

    if (reports.length === 0) {
      return res.status(404).json({
        error: 'No reports found'
      });
    }

    res.json({
      data: reports[0],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get latest report:', error);
    res.status(500).json({
      error: 'Failed to retrieve latest report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
