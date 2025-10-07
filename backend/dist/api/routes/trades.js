"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Elysian Trading System - Trades API Routes
 */
const express_1 = require("express");
const logger_1 = require("../../utils/logger");
const database_1 = require("../../utils/database");
const router = (0, express_1.Router)();
// Get recent trades
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        if (limit < 1 || limit > 200) {
            return res.status(400).json({
                error: 'Limit must be between 1 and 200',
                timestamp: new Date().toISOString()
            });
        }
        const query = `
      SELECT * FROM trades 
      ORDER BY timestamp DESC 
      LIMIT $1
    `;
        const result = await database_1.DatabaseManager.query(query, [limit]);
        const trades = result.rows.map((row) => ({
            id: row.id,
            symbol: row.symbol,
            side: row.side,
            quantity: parseInt(row.quantity),
            price: parseFloat(row.price),
            executed_price: parseFloat(row.executed_price),
            timestamp: new Date(row.timestamp),
            status: row.status,
            commission: parseFloat(row.commission || '0'),
            slippage: parseFloat(row.slippage || '0')
        }));
        res.json({
            data: trades,
            count: trades.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get trades:', error);
        res.status(500).json({
            error: 'Failed to retrieve trades',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Get trading statistics
router.get('/stats', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const query = `
      SELECT 
        COUNT(*) as total_trades,
        COUNT(CASE WHEN side = 'BUY' THEN 1 END) as buy_trades,
        COUNT(CASE WHEN side = 'SELL' THEN 1 END) as sell_trades,
        AVG(executed_price) as avg_price,
        SUM(quantity) as total_volume
      FROM trades 
      WHERE timestamp >= NOW() - INTERVAL '${days} days'
    `;
        const result = await database_1.DatabaseManager.query(query);
        const row = result.rows[0] || {};
        const stats = {
            total_trades: parseInt(row.total_trades || '0'),
            buy_trades: parseInt(row.buy_trades || '0'),
            sell_trades: parseInt(row.sell_trades || '0'),
            avg_price: parseFloat(row.avg_price || '0'),
            total_volume: parseInt(row.total_volume || '0'),
            period_days: days
        };
        res.json({
            data: stats,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get trading stats:', error);
        res.status(500).json({
            error: 'Failed to retrieve trading statistics',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
