"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Elysian Trading System - Reports API Routes
 */
const express_1 = require("express");
const logger_1 = require("../../utils/logger");
const reports_1 = require("../../reports");
const database_1 = require("../../utils/database");
const router = (0, express_1.Router)();
// Get latest report
router.get('/latest', async (req, res) => {
    try {
        const query = `
      SELECT * FROM performance_reports 
      ORDER BY timestamp DESC 
      LIMIT 1
    `;
        const result = await database_1.DatabaseManager.query(query);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'No reports found',
                timestamp: new Date().toISOString()
            });
        }
        const row = result.rows[0];
        const report = {
            id: row.id,
            timestamp: new Date(row.timestamp),
            period_start: new Date(row.period_start),
            period_end: new Date(row.period_end),
            report_type: row.report_type,
            summary: JSON.parse(row.summary || '{}'),
            metrics: JSON.parse(row.metrics || '{}')
        };
        res.json({
            data: report,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get latest report:', error);
        res.status(500).json({
            error: 'Failed to retrieve latest report',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Generate new report
router.post('/generate', async (req, res) => {
    try {
        const days = parseInt(req.body.days) || 30;
        if (days < 1 || days > 365) {
            return res.status(400).json({
                error: 'Days must be between 1 and 365',
                timestamp: new Date().toISOString()
            });
        }
        const report = await reports_1.reportsGenerator.generatePerformanceReport(days);
        res.json({
            data: report,
            message: 'Performance report generated successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to generate report:', error);
        res.status(500).json({
            error: 'Failed to generate report',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
