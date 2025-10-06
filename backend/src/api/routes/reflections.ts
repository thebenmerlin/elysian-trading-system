/**
 * Elysian Trading System - Reflections API Routes
 */

import { Router } from 'express';
import { logger } from '@/utils/logger';
import { reflectionEngine } from '@/reflection';

const router = Router();

// Get latest reflections
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const reflections = await reflectionEngine.getLatestReflections(limit);

    res.json({
      data: reflections,
      count: reflections.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get reflections:', error);
    res.status(500).json({
      error: 'Failed to retrieve reflections',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
