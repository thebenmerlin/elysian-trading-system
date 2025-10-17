"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.portfolioManager = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
class PortfolioManager {
    constructor() {
        this.initialCash = 100000;
        this.initialCash = parseFloat(process.env.INITIAL_CASH || '100000');
    }
    createDefaultMetrics(positionsCount = 0) {
        return {
            total_return_pct: 0,
            sharpe_ratio: 0,
            max_drawdown_pct: 0,
            win_rate: 0,
            volatility: 0,
            beta: 1.0,
            alpha: 0,
            positions_count: positionsCount
        };
    }
    async createPortfolioSnapshot() {
        try {
            logger_1.logger.info('Creating portfolio snapshot...');
            const positions = await this.getCurrentPositions();
            const positionsValue = positions.reduce((sum, pos) => sum + pos.market_value, 0);
            const cash = await this.getCashBalance();
            const totalValue = cash + positionsValue;
            const prevSnapshot = await this.getPreviousSnapshot();
            const dailyPnL = prevSnapshot ? totalValue - prevSnapshot.total_value : 0;
            const totalPnL = totalValue - this.initialCash;
            const allocations = {};
            positions.forEach(pos => {
                allocations[pos.symbol] = (pos.market_value / totalValue) * 100;
            });
            const metrics = await this.calculateMetrics(positions, totalValue);
            const snapshot = {
                timestamp: new Date(),
                total_value: totalValue,
                cash,
                positions_value: positionsValue,
                daily_pnl: dailyPnL,
                total_pnl: totalPnL,
                allocations,
                metrics
            };
            await this.storeSnapshot(snapshot);
            logger_1.logger.info('Portfolio snapshot created', {
                total_value: totalValue,
                daily_pnl: dailyPnL
            });
            return snapshot;
        }
        catch (error) {
            logger_1.logger.error('Failed to create portfolio snapshot:', error);
            throw error;
        }
    }
    async getPreviousSnapshot() {
        try {
            const query = `
        SELECT * FROM portfolio_snapshots 
        ORDER BY timestamp DESC 
        LIMIT 1 OFFSET 1
      `;
            const result = await database_1.DatabaseManager.query(query);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            let allocations = {};
            let metrics = this.createDefaultMetrics(0);
            try {
                allocations = row.allocation ?
                    (typeof row.allocation === 'string' ? JSON.parse(row.allocation) : row.allocation) : {};
            }
            catch (allocError) {
                logger_1.logger.warn('Failed to parse allocation JSON, using empty object:', allocError);
                allocations = {};
            }
            try {
                const parsedMetrics = row.metrics ?
                    (typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics) : {};
                metrics = {
                    ...this.createDefaultMetrics(0),
                    ...parsedMetrics
                };
            }
            catch (metricsError) {
                logger_1.logger.warn('Failed to parse metrics JSON, using default metrics:', metricsError);
                metrics = this.createDefaultMetrics(0);
            }
            return {
                id: row.id,
                timestamp: new Date(row.timestamp),
                total_value: parseFloat(row.total_value),
                cash: parseFloat(row.cash),
                positions_value: parseFloat(row.positions_value),
                daily_pnl: parseFloat(row.daily_pnl || 0),
                total_pnl: parseFloat(row.total_pnl || 0),
                allocations,
                metrics
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get previous snapshot:', error);
            return null;
        }
    }
    async getLatestPortfolioSnapshot() {
        try {
            const query = `
        SELECT * FROM portfolio_snapshots 
        ORDER BY timestamp DESC 
        LIMIT 1
      `;
            const result = await database_1.DatabaseManager.query(query);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            let allocations = {};
            let metrics = this.createDefaultMetrics(0);
            try {
                allocations = row.allocation ?
                    (typeof row.allocation === 'string' ? JSON.parse(row.allocation) : row.allocation) : {};
            }
            catch (allocError) {
                logger_1.logger.warn('Failed to parse allocation JSON, using empty object:', allocError);
                allocations = {};
            }
            try {
                const parsedMetrics = row.metrics ?
                    (typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics) : {};
                metrics = {
                    ...this.createDefaultMetrics(0),
                    ...parsedMetrics
                };
            }
            catch (metricsError) {
                logger_1.logger.warn('Failed to parse metrics JSON, using default metrics:', metricsError);
                metrics = this.createDefaultMetrics(0);
            }
            return {
                id: row.id,
                timestamp: new Date(row.timestamp),
                total_value: parseFloat(row.total_value),
                cash: parseFloat(row.cash),
                positions_value: parseFloat(row.positions_value),
                daily_pnl: parseFloat(row.daily_pnl || 0),
                total_pnl: parseFloat(row.total_pnl || 0),
                allocations,
                metrics
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get latest snapshot:', error);
            return null;
        }
    }
    async getCurrentPositions() {
        try {
            const query = `
        SELECT p.*, md.close as current_price
        FROM positions p
        LEFT JOIN LATERAL (
          SELECT close 
          FROM market_data 
          WHERE symbol = p.symbol 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) md ON true
        WHERE p.quantity > 0
        ORDER BY p.symbol
      `;
            const result = await database_1.DatabaseManager.query(query);
            return result.rows.map((row) => {
                const currentPrice = parseFloat(row.current_price || row.average_price);
                const marketValue = row.quantity * currentPrice;
                const unrealizedPnL = (currentPrice - row.average_price) * row.quantity;
                return {
                    id: row.id,
                    symbol: row.symbol,
                    quantity: parseInt(row.quantity),
                    average_price: parseFloat(row.average_price),
                    current_price: currentPrice,
                    unrealized_pnl: unrealizedPnL,
                    market_value: marketValue,
                    allocation_pct: 0,
                    timestamp: new Date(row.timestamp)
                };
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get current positions:', error);
            return [];
        }
    }
    async getCashBalance() {
        try {
            let cash = this.initialCash;
            const tradesQuery = `
        SELECT SUM(
          CASE 
            WHEN side = 'BUY' THEN -(quantity * executed_price)
            WHEN side = 'SELL' THEN (quantity * executed_price)
          END
        ) as net_cash_flow
        FROM trades
      `;
            const result = await database_1.DatabaseManager.query(tradesQuery);
            const netCashFlow = parseFloat(result.rows[0]?.net_cash_flow || 0);
            cash += netCashFlow;
            return Math.max(cash, 0);
        }
        catch (error) {
            logger_1.logger.error('Failed to get cash balance:', error);
            return this.initialCash;
        }
    }
    async calculateMetrics(positions, totalValue) {
        try {
            const historyQuery = `
        SELECT total_value, timestamp 
        FROM portfolio_snapshots 
        ORDER BY timestamp DESC 
        LIMIT 30
      `;
            const historyResult = await database_1.DatabaseManager.query(historyQuery);
            const history = historyResult.rows;
            const totalReturnPct = ((totalValue - this.initialCash) / this.initialCash) * 100;
            let volatility = 0;
            if (history.length > 1) {
                const returns = [];
                for (let i = 1; i < history.length; i++) {
                    const currentVal = parseFloat(history[i - 1].total_value);
                    const prevVal = parseFloat(history[i].total_value);
                    if (prevVal > 0) {
                        returns.push((currentVal - prevVal) / prevVal);
                    }
                }
                if (returns.length > 0) {
                    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
                    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
                    volatility = Math.sqrt(variance) * Math.sqrt(252);
                }
            }
            const riskFreeRate = 0.02;
            const sharpeRatio = volatility > 0 ? (totalReturnPct / 100 - riskFreeRate) / volatility : 0;
            let maxDrawdown = 0;
            if (history.length > 1) {
                let peak = parseFloat(history[0].total_value);
                for (const snapshot of history) {
                    const value = parseFloat(snapshot.total_value);
                    if (value > peak) {
                        peak = value;
                    }
                    const drawdown = (peak - value) / peak;
                    if (drawdown > maxDrawdown) {
                        maxDrawdown = drawdown;
                    }
                }
            }
            const tradesQuery = `
        SELECT 
          SUM(CASE WHEN (executed_price - (
            SELECT AVG(executed_price) 
            FROM trades t2 
            WHERE t2.symbol = t1.symbol 
            AND t2.timestamp < t1.timestamp 
            AND t2.side = 'BUY'
          )) > 0 THEN 1 ELSE 0 END) as wins,
          COUNT(*) as total_trades
        FROM trades t1 
        WHERE side = 'SELL' 
        AND timestamp >= NOW() - INTERVAL '30 days'
      `;
            const tradesResult = await database_1.DatabaseManager.query(tradesQuery);
            const wins = parseInt(tradesResult.rows[0]?.wins || 0);
            const totalTrades = parseInt(tradesResult.rows[0]?.total_trades || 0);
            const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
            return {
                total_return_pct: totalReturnPct,
                sharpe_ratio: sharpeRatio,
                max_drawdown_pct: maxDrawdown * 100,
                win_rate: winRate,
                volatility: volatility * 100,
                beta: 1.0,
                alpha: 0,
                positions_count: positions.length
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to calculate metrics:', error);
            return this.createDefaultMetrics(positions.length);
        }
    }
    async storeSnapshot(snapshot) {
        try {
            const query = `
        INSERT INTO portfolio_snapshots (
          timestamp, total_value, cash, positions_value, daily_pnl, total_pnl, 
          allocation, metrics
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
            await database_1.DatabaseManager.query(query, [
                snapshot.timestamp,
                snapshot.total_value,
                snapshot.cash,
                snapshot.positions_value,
                snapshot.daily_pnl,
                snapshot.total_pnl,
                JSON.stringify(snapshot.allocations),
                JSON.stringify(snapshot.metrics)
            ]);
        }
        catch (error) {
            logger_1.logger.error('Failed to store portfolio snapshot:', error);
            throw error;
        }
    }
    async executeTrade(trade) {
        try {
            const tradeQuery = `
        INSERT INTO trades (
          symbol, side, quantity, price, executed_price, timestamp, 
          strategy, confidence, market_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;
            await database_1.DatabaseManager.query(tradeQuery, [
                trade.symbol,
                trade.side,
                trade.quantity,
                trade.price,
                trade.executed_price,
                trade.timestamp,
                trade.strategy,
                trade.confidence,
                trade.market_type || 'equity'
            ]);
            await this.updatePosition(trade);
            logger_1.logger.info(`Trade executed: ${trade.side} ${trade.quantity} ${trade.symbol} @ $${trade.executed_price}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to execute trade:', error);
            throw error;
        }
    }
    async updatePosition(trade) {
        try {
            if (trade.side === 'BUY') {
                const upsertQuery = `
          INSERT INTO positions (symbol, quantity, average_price, timestamp, market_type)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (symbol) DO UPDATE SET
            quantity = positions.quantity + EXCLUDED.quantity,
            average_price = (
              (positions.quantity * positions.average_price) + 
              (EXCLUDED.quantity * EXCLUDED.average_price)
            ) / (positions.quantity + EXCLUDED.quantity),
            timestamp = EXCLUDED.timestamp
        `;
                await database_1.DatabaseManager.query(upsertQuery, [
                    trade.symbol,
                    trade.quantity,
                    trade.executed_price,
                    trade.timestamp,
                    trade.market_type || 'equity'
                ]);
            }
            else if (trade.side === 'SELL') {
                const updateQuery = `
          UPDATE positions 
          SET quantity = quantity - $2, timestamp = $3
          WHERE symbol = $1
        `;
                await database_1.DatabaseManager.query(updateQuery, [
                    trade.symbol,
                    trade.quantity,
                    trade.timestamp
                ]);
                const cleanupQuery = `DELETE FROM positions WHERE quantity <= 0`;
                await database_1.DatabaseManager.query(cleanupQuery);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to update position:', error);
            throw error;
        }
    }
    async getPerformanceHistory(days = 30) {
        try {
            const query = `
        SELECT * FROM portfolio_snapshots 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY timestamp DESC
        LIMIT 1000
      `;
            const result = await database_1.DatabaseManager.query(query);
            return result.rows.map((row) => {
                let allocations = {};
                let metrics = this.createDefaultMetrics(0);
                try {
                    allocations = row.allocation ?
                        (typeof row.allocation === 'string' ? JSON.parse(row.allocation) : row.allocation) : {};
                }
                catch (error) {
                    allocations = {};
                }
                try {
                    const parsedMetrics = row.metrics ?
                        (typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics) : {};
                    metrics = {
                        ...this.createDefaultMetrics(0),
                        ...parsedMetrics
                    };
                }
                catch (error) {
                    metrics = this.createDefaultMetrics(0);
                }
                return {
                    id: row.id,
                    timestamp: new Date(row.timestamp),
                    total_value: parseFloat(row.total_value),
                    cash: parseFloat(row.cash),
                    positions_value: parseFloat(row.positions_value),
                    daily_pnl: parseFloat(row.daily_pnl || 0),
                    total_pnl: parseFloat(row.total_pnl || 0),
                    allocations,
                    metrics
                };
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get performance history:', error);
            return [];
        }
    }
}
exports.portfolioManager = new PortfolioManager();
