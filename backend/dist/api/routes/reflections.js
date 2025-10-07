"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Elysian Trading System - Reflections API Routes
 */
const express_1 = require("express");
const logger_1 = require("../../utils/logger");
const reflection_1 = require("../../reflection");
const database_1 = require("../../utils/database");
const router = (0, express_1.Router)();
// Get latest reflection
router.get('/latest', async (req, res) => {
    try {
        const query = `
      SELECT * FROM reflections 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
        const result = await database_1.DatabaseManager.query(query);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'No reflections found',
                timestamp: new Date().toISOString()
            });
        }
        const row = result.rows[0];
        const reflection = {
            id: row.id,
            timestamp: new Date(row.timestamp),
            period_start: new Date(row.period_start),
            period_end: new Date(row.period_end),
            performance_summary: JSON.parse(row.performance_summary || '{}'),
            key_insights: row.key_insights || [],
            mistakes_identified: JSON.parse(row.mistakes_identified || '{}'),
            successful_patterns: JSON.parse(row.successful_patterns || '{}'),
            recommended_adjustments: JSON.parse(row.recommended_adjustments || '{}'),
            confidence_score: parseFloat(row.confidence_score || '0')
        };
        res.json({
            data: reflection,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get latest reflection:', error);
        res.status(500).json({
            error: 'Failed to retrieve latest reflection',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Generate new reflection
router.post('/generate', async (req, res) => {
    try {
        const days = parseInt(req.body.days) || 7;
        if (days < 1 || days > 365) {
            return res.status(400).json({
                error: 'Days must be between 1 and 365',
                timestamp: new Date().toISOString()
            });
        }
        const reflection = await reflection_1.reflectionEngine.generateReflection(days);
        res.json({
            data: reflection,
            message: 'Reflection generated successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to generate reflection:', error);
        res.status(500).json({
            error: 'Failed to generate reflection',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
