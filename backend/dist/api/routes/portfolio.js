"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const portfolio_1 = require("../../portfolio");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
router.get('/current', async (req, res) => {
    try {
        const snapshot = await portfolio_1.portfolioManager.getLatestPortfolioSnapshot();
        if (!snapshot) {
            return res.json({
                data: {
                    total_value: 100000,
                    cash: 100000,
                    positions_value: 0,
                    daily_pnl: 0,
                    total_pnl: 0,
                    allocations: {},
                    metrics: {
                        total_return_pct: 0,
                        sharpe_ratio: 0,
                        max_drawdown_pct: 0,
                        win_rate: 0,
                        volatility: 0,
                        beta: 1.0,
                        alpha: 0,
                        positions_count: 0
                    }
                },
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            data: snapshot,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get current portfolio:', error);
        res.status(500).json({
            error: 'Failed to retrieve portfolio',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/history', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const history = await portfolio_1.portfolioManager.getPerformanceHistory(days);
        res.json({
            data: history,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get portfolio history:', error);
        res.status(500).json({
            error: 'Failed to retrieve portfolio history',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/positions', async (req, res) => {
    try {
        const positions = await portfolio_1.portfolioManager.getCurrentPositions();
        res.json({
            data: positions,
            count: positions.length,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get positions:', error);
        res.status(500).json({
            error: 'Failed to retrieve positions',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/metrics', async (req, res) => {
    try {
        const snapshot = await portfolio_1.portfolioManager.getLatestPortfolioSnapshot();
        if (!snapshot) {
            return res.json({
                data: {
                    total_return_pct: 0,
                    sharpe_ratio: 0,
                    max_drawdown_pct: 0,
                    win_rate: 0,
                    volatility: 0,
                    beta: 1.0,
                    alpha: 0,
                    positions_count: 0
                },
                timestamp: new Date().toISOString()
            });
        }
        res.json({
            data: {
                ...snapshot.metrics,
                total_value: snapshot.total_value,
                cash: snapshot.cash,
                positions_value: snapshot.positions_value,
                daily_pnl: snapshot.daily_pnl,
                total_pnl: snapshot.total_pnl,
                allocations: snapshot.allocations
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get portfolio metrics:', error);
        res.status(500).json({
            error: 'Failed to retrieve metrics',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/cash', async (req, res) => {
    try {
        const cash = await portfolio_1.portfolioManager.getCashBalance();
        res.json({
            data: {
                cash_balance: cash,
                currency: 'USD'
            },
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get cash balance:', error);
        res.status(500).json({
            error: 'Failed to retrieve cash balance',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/snapshot', async (req, res) => {
    try {
        const snapshot = await portfolio_1.portfolioManager.createPortfolioSnapshot();
        res.json({
            data: snapshot,
            message: 'Portfolio snapshot created successfully',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create portfolio snapshot:', error);
        res.status(500).json({
            error: 'Failed to create snapshot',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
