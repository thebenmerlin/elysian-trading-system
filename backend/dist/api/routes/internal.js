"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Elysian Trading System - Internal API Routes
 */
const express_1 = require("express");
const database_1 = require("../../utils/database");
const runner_1 = require("../../runner");
const router = (0, express_1.Router)();
// System health check
router.get('/health', async (req, res) => {
    try {
        const dbHealthy = await database_1.DatabaseManager.healthCheck();
        const runnerStatus = runner_1.tradingRunner.getRunnerStatus();
        res.json({
            status: dbHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            components: {
                database: dbHealthy ? 'healthy' : 'unhealthy',
                trading_runner: runnerStatus.is_running ? 'running' : 'stopped'
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
// Get runner status
router.get('/runner/status', async (req, res) => {
    try {
        const status = runner_1.tradingRunner.getRunnerStatus();
        res.json({
            data: status,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to get runner status',
            timestamp: new Date().toISOString()
        });
    }
});
// Start trading runner
router.post('/runner/start', async (req, res) => {
    try {
        await runner_1.tradingRunner.startRunner();
        res.json({
            message: 'Trading runner started',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to start runner',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Stop trading runner
router.post('/runner/stop', async (req, res) => {
    try {
        await runner_1.tradingRunner.stopRunner();
        res.json({
            message: 'Trading runner stopped',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to stop runner',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
// Run single cycle
router.post('/runner/cycle', async (req, res) => {
    try {
        const cycle = await runner_1.tradingRunner.runSingleCycle();
        res.json({
            data: cycle,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Cycle failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
