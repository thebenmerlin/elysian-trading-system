"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionEngine = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const portfolio_1 = require("../portfolio");
class ExecutionEngine {
    constructor() {
        this.MAX_POSITION_SIZE = 0.10;
        this.MAX_PORTFOLIO_RISK = 0.20;
        this.MIN_LIQUIDITY_REQUIREMENT = 0.05;
        this.MAX_CORRELATION_EXPOSURE = 0.40;
        this.COMMISSION_PER_TRADE = 1.0;
        this.MAX_DAILY_TRADES = 20;
        this.dailyTradeCount = 0;
        this.lastTradeDate = new Date();
        this.DEFAULT_WIN_RATE = 0.55;
        this.DEFAULT_AVG_WIN = 0.025;
        this.DEFAULT_AVG_LOSS = 0.018;
    }
    async evaluateAndExecute(signal, aiAnalysis, portfolioValue) {
        try {
            logger_1.logger.info(`🎯 Evaluating trade signal for ${signal.symbol}`, {
                signal_type: signal.signal_type,
                strength: signal.strength,
                confidence: signal.confidence,
                risk_score: signal.risk_score
            });
            const riskChecks = await this.performRiskChecks(signal, portfolioValue);
            if (!riskChecks.approved) {
                logger_1.logger.warn(`❌ Trade rejected for ${signal.symbol}: ${riskChecks.reason}`);
                return null;
            }
            const positionSizing = await this.calculateOptimalPositionSize(signal, portfolioValue);
            if (positionSizing.quantity === 0) {
                logger_1.logger.debug(`📏 Zero position size calculated for ${signal.symbol}`);
                return null;
            }
            const executionPrice = await this.calculateExecutionPrice(signal);
            const trade = {
                id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                symbol: signal.symbol,
                side: signal.signal_type,
                quantity: positionSizing.quantity,
                price: signal.target_price || executionPrice.target,
                executed_price: executionPrice.executed,
                timestamp: new Date(),
                status: 'FILLED',
                commission: this.COMMISSION_PER_TRADE,
                slippage: executionPrice.slippage,
                signal_id: signal.id,
                ai_analysis_id: aiAnalysis?.id,
                metadata: {
                    position_size_pct: positionSizing.position_size_pct,
                    kelly_fraction: positionSizing.kelly_fraction,
                    risk_score: signal.risk_score,
                    confidence: signal.confidence,
                    stop_loss: positionSizing.stop_loss,
                    take_profit: positionSizing.take_profit,
                    expected_return: positionSizing.expected_return,
                    max_loss: positionSizing.max_loss
                }
            };
            await this.executeTrade(trade);
            await this.updatePortfolioPositions(trade);
            this.updateDailyTradeCount();
            logger_1.logger.info(`✅ TRADE EXECUTED: ${trade.side} ${trade.quantity} ${trade.symbol} @ $${trade.executed_price.toFixed(2)}`, {
                position_size_pct: trade.metadata.position_size_pct,
                kelly_fraction: trade.metadata.kelly_fraction,
                expected_return: trade.metadata.expected_return,
                max_loss: trade.metadata.max_loss
            });
            return trade;
        }
        catch (error) {
            logger_1.logger.error(`❌ Trade execution failed for ${signal.symbol}:`, error);
            return null;
        }
    }
    async performRiskChecks(signal, portfolioValue) {
        try {
            if (signal.confidence < 0.6) {
                return { approved: false, reason: `Low confidence: ${signal.confidence.toFixed(3)}` };
            }
            if (signal.risk_score > 0.8) {
                return { approved: false, reason: `High risk score: ${signal.risk_score.toFixed(3)}` };
            }
            if (signal.strength < 0.3) {
                return { approved: false, reason: `Weak signal strength: ${signal.strength.toFixed(3)}` };
            }
            if (this.dailyTradeCount >= this.MAX_DAILY_TRADES) {
                return { approved: false, reason: 'Daily trade limit exceeded' };
            }
            const currentPositions = await this.getCurrentPositions();
            const existingPosition = currentPositions.find(p => p.symbol === signal.symbol);
            if (!existingPosition) {
                const positionCount = currentPositions.length;
                if (positionCount >= 10) {
                    return { approved: false, reason: 'Maximum position count reached (10)' };
                }
            }
            const cashRatio = await this.getCashRatio();
            if (cashRatio < this.MIN_LIQUIDITY_REQUIREMENT) {
                return { approved: false, reason: `Insufficient liquidity: ${(cashRatio * 100).toFixed(1)}%` };
            }
            const sectorExposure = await this.calculateSectorExposure(signal.symbol, currentPositions);
            if (sectorExposure > this.MAX_CORRELATION_EXPOSURE) {
                return { approved: false, reason: `Sector exposure limit: ${(sectorExposure * 100).toFixed(1)}%` };
            }
            const portfolioRisk = await this.calculatePortfolioVaR(currentPositions);
            if (portfolioRisk.portfolio_var_95 > this.MAX_PORTFOLIO_RISK * portfolioValue) {
                return { approved: false, reason: `Portfolio VaR limit exceeded: ${(portfolioRisk.portfolio_var_95 / portfolioValue * 100).toFixed(1)}%` };
            }
            const marketVolatility = await this.getMarketVolatility(signal.symbol);
            if (marketVolatility > 0.5) {
                return { approved: false, reason: `Extreme volatility: ${(marketVolatility * 100).toFixed(1)}%` };
            }
            return { approved: true };
        }
        catch (error) {
            logger_1.logger.error('Risk check failed:', error);
            return { approved: false, reason: 'Risk check system error' };
        }
    }
    async calculateOptimalPositionSize(signal, portfolioValue) {
        try {
            const historicalPerformance = await this.getSignalPerformanceStats(signal.source);
            const winRate = historicalPerformance.win_rate || this.DEFAULT_WIN_RATE;
            const avgWin = historicalPerformance.avg_win || this.DEFAULT_AVG_WIN;
            const avgLoss = historicalPerformance.avg_loss || this.DEFAULT_AVG_LOSS;
            const b = avgWin / avgLoss;
            const p = winRate;
            const q = 1 - winRate;
            const rawKellyFraction = (b * p - q) / b;
            const confidenceAdjustment = signal.confidence;
            const riskAdjustment = 1 - signal.risk_score;
            let kellyFraction = rawKellyFraction * confidenceAdjustment * riskAdjustment;
            kellyFraction = Math.max(0, Math.min(kellyFraction, 0.25));
            let positionSizePct = kellyFraction * signal.strength;
            positionSizePct = Math.min(positionSizePct, this.MAX_POSITION_SIZE);
            const existingPosition = await this.getExistingPosition(signal.symbol);
            if (existingPosition) {
                const currentAllocation = existingPosition.market_value / portfolioValue;
                const maxAdditionalAllocation = this.MAX_POSITION_SIZE - currentAllocation;
                positionSizePct = Math.min(positionSizePct, maxAdditionalAllocation);
            }
            const positionValue = portfolioValue * positionSizePct;
            const targetPrice = signal.target_price || signal.price || 100;
            const quantity = Math.floor(positionValue / targetPrice);
            const stopLossDistance = targetPrice * 0.02;
            const takeProfitDistance = targetPrice * 0.05;
            const stopLoss = signal.signal_type === 'BUY'
                ? targetPrice - stopLossDistance
                : targetPrice + stopLossDistance;
            const takeProfit = signal.signal_type === 'BUY'
                ? targetPrice + takeProfitDistance
                : targetPrice - takeProfitDistance;
            const expectedReturn = positionValue * (avgWin * winRate - avgLoss * (1 - winRate));
            const maxLoss = quantity * stopLossDistance;
            logger_1.logger.debug(`📊 Position sizing for ${signal.symbol}:`, {
                kelly_fraction: kellyFraction,
                position_size_pct: positionSizePct,
                quantity,
                expected_return: expectedReturn,
                max_loss: maxLoss,
                win_rate: winRate,
                avg_win: avgWin,
                avg_loss: avgLoss
            });
            return {
                quantity,
                position_size_pct: positionSizePct,
                kelly_fraction: kellyFraction,
                expected_return: expectedReturn,
                max_loss: maxLoss,
                stop_loss: stopLoss,
                take_profit: takeProfit
            };
        }
        catch (error) {
            logger_1.logger.error('Position sizing calculation failed:', error);
            return {
                quantity: 0,
                position_size_pct: 0,
                kelly_fraction: 0,
                expected_return: 0,
                max_loss: 0,
                stop_loss: 0,
                take_profit: 0
            };
        }
    }
    async calculateExecutionPrice(signal) {
        const targetPrice = signal.target_price || signal.price || 100;
        const volatility = await this.getMarketVolatility(signal.symbol);
        const baseSlippageBps = 2;
        const volatilitySlippageBps = volatility * 100;
        const totalSlippageBps = baseSlippageBps + volatilitySlippageBps;
        const slippageAmount = targetPrice * (totalSlippageBps / 10000);
        const executedPrice = signal.signal_type === 'BUY'
            ? targetPrice + slippageAmount
            : targetPrice - slippageAmount;
        return {
            target: targetPrice,
            executed: parseFloat(executedPrice.toFixed(4)),
            slippage: parseFloat(slippageAmount.toFixed(4))
        };
    }
    async executeTrade(trade) {
        try {
            await this.storeTrade(trade);
            logger_1.logger.info(`📋 Trade details stored:`, {
                id: trade.id,
                symbol: trade.symbol,
                side: trade.side,
                quantity: trade.quantity,
                executed_price: trade.executed_price,
                commission: trade.commission,
                slippage: trade.slippage
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to execute trade:', error);
            throw error;
        }
    }
    async storeTrade(trade) {
        try {
            const query = `
        INSERT INTO trades (
          id, symbol, side, quantity, price, executed_price, timestamp, 
          status, commission, signal_id, ai_analysis_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;
            await database_1.DatabaseManager.query(query, [
                trade.id,
                trade.symbol,
                trade.side,
                trade.quantity,
                trade.price,
                trade.executed_price,
                trade.timestamp,
                trade.status,
                trade.commission,
                trade.signal_id,
                trade.ai_analysis_id,
                JSON.stringify(trade.metadata)
            ]);
        }
        catch (error) {
            logger_1.logger.error('Failed to store trade:', error);
            throw error;
        }
    }
    async updatePortfolioPositions(trade) {
        try {
            const existingPosition = await this.getExistingPosition(trade.symbol);
            if (existingPosition) {
                await this.updatePosition(trade, existingPosition);
            }
            else {
                await this.createNewPosition(trade);
            }
            logger_1.logger.debug(`📊 Position updated for ${trade.symbol}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to update portfolio positions:', error);
            throw error;
        }
    }
    async updatePosition(trade, existingPosition) {
        let newQuantity = existingPosition.quantity;
        let newAvgPrice = existingPosition.avg_price;
        if (trade.side === 'BUY') {
            const totalCost = (existingPosition.quantity * existingPosition.avg_price) +
                (trade.quantity * trade.executed_price);
            newQuantity += trade.quantity;
            newAvgPrice = totalCost / newQuantity;
        }
        else {
            newQuantity -= trade.quantity;
        }
        const query = `
      UPDATE positions 
      SET quantity = $1, avg_price = $2, last_update = NOW()
      WHERE symbol = $3
    `;
        await database_1.DatabaseManager.query(query, [newQuantity, newAvgPrice, trade.symbol]);
    }
    async createNewPosition(trade) {
        if (trade.side === 'SELL') {
            logger_1.logger.warn(`Cannot create new position with SELL trade for ${trade.symbol}`);
            return;
        }
        const query = `
      INSERT INTO positions (
        symbol, quantity, avg_price, current_price, market_value, 
        unrealized_pnl, unrealized_pnl_pct, first_purchase
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
        const marketValue = trade.quantity * trade.executed_price;
        await database_1.DatabaseManager.query(query, [
            trade.symbol,
            trade.quantity,
            trade.executed_price,
            trade.executed_price,
            marketValue,
            0,
            0,
            trade.timestamp
        ]);
    }
    async getCurrentPositions() {
        try {
            const query = `SELECT * FROM positions WHERE quantity != 0`;
            const result = await database_1.DatabaseManager.query(query);
            return result.rows.map((row) => ({
                symbol: row.symbol,
                quantity: parseInt(row.quantity),
                avg_price: parseFloat(row.avg_price),
                current_price: parseFloat(row.current_price),
                market_value: parseFloat(row.market_value),
                unrealized_pnl: parseFloat(row.unrealized_pnl),
                unrealized_pnl_pct: parseFloat(row.unrealized_pnl_pct),
                allocation_pct: 0,
                risk_contribution: 0,
                days_held: 0
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get current positions:', error);
            return [];
        }
    }
    async getExistingPosition(symbol) {
        try {
            const query = `SELECT * FROM positions WHERE symbol = $1`;
            const result = await database_1.DatabaseManager.query(query, [symbol]);
            if (result.rows.length === 0)
                return null;
            const row = result.rows[0];
            return {
                symbol: row.symbol,
                quantity: parseInt(row.quantity),
                avg_price: parseFloat(row.avg_price),
                current_price: parseFloat(row.current_price),
                market_value: parseFloat(row.market_value),
                unrealized_pnl: parseFloat(row.unrealized_pnl),
                unrealized_pnl_pct: parseFloat(row.unrealized_pnl_pct),
                allocation_pct: 0,
                risk_contribution: 0,
                days_held: 0
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get existing position:', error);
            return null;
        }
    }
    async getCashRatio() {
        try {
            const portfolio = await portfolio_1.portfolioManager.getLatestPortfolioSnapshot();
            if (!portfolio)
                return 1.0;
            return portfolio.cash / portfolio.total_value;
        }
        catch (error) {
            logger_1.logger.error('Failed to get cash ratio:', error);
            return 0.5;
        }
    }
    async calculateSectorExposure(symbol, positions) {
        const sectors = {
            'TECH': ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META'],
            'AUTO': ['TSLA'],
            'ECOMMERCE': ['AMZN']
        };
        let targetSector = 'OTHER';
        for (const [sector, symbols] of Object.entries(sectors)) {
            if (symbols.includes(symbol)) {
                targetSector = sector;
                break;
            }
        }
        if (targetSector === 'OTHER')
            return 0;
        const sectorSymbols = sectors[targetSector];
        const sectorPositions = positions.filter(p => sectorSymbols.includes(p.symbol));
        const totalSectorValue = sectorPositions.reduce((sum, p) => sum + p.market_value, 0);
        const totalPortfolioValue = positions.reduce((sum, p) => sum + p.market_value, 0);
        return totalSectorValue / totalPortfolioValue;
    }
    async calculatePortfolioVaR(positions) {
        const totalValue = positions.reduce((sum, p) => sum + p.market_value, 0);
        const avgVolatility = 0.02;
        return {
            portfolio_var_95: totalValue * avgVolatility * 1.65,
            portfolio_var_99: totalValue * avgVolatility * 2.33,
            max_drawdown: totalValue * 0.1,
            sharpe_ratio: 1.0,
            concentration_risk: 0.5,
            leverage: 1.0,
            beta: 1.0
        };
    }
    async getMarketVolatility(symbol) {
        try {
            const query = `
        SELECT close FROM market_data 
        WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '20 days'
        ORDER BY timestamp ASC
      `;
            const result = await database_1.DatabaseManager.query(query, [symbol]);
            if (result.rows.length < 10)
                return 0.02;
            const prices = result.rows.map((row) => parseFloat(row.close));
            const returns = [];
            for (let i = 1; i < prices.length; i++) {
                returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
            }
            const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
            return Math.sqrt(variance);
        }
        catch (error) {
            logger_1.logger.error('Failed to calculate market volatility:', error);
            return 0.02;
        }
    }
    async getSignalPerformanceStats(source) {
        try {
            const sourceStats = {
                'momentum_crossover': { win_rate: 0.58, avg_win: 0.028, avg_loss: 0.016 },
                'mean_reversion': { win_rate: 0.52, avg_win: 0.022, avg_loss: 0.018 },
                'breakout': { win_rate: 0.48, avg_win: 0.035, avg_loss: 0.020 },
                'candlestick_patterns': { win_rate: 0.54, avg_win: 0.018, avg_loss: 0.015 },
                'ensemble': { win_rate: 0.60, avg_win: 0.025, avg_loss: 0.017 }
            };
            return sourceStats[source] || {
                win_rate: this.DEFAULT_WIN_RATE,
                avg_win: this.DEFAULT_AVG_WIN,
                avg_loss: this.DEFAULT_AVG_LOSS
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get signal performance stats:', error);
            return {
                win_rate: this.DEFAULT_WIN_RATE,
                avg_win: this.DEFAULT_AVG_WIN,
                avg_loss: this.DEFAULT_AVG_LOSS
            };
        }
    }
    updateDailyTradeCount() {
        const today = new Date().toDateString();
        const lastTradeDay = this.lastTradeDate.toDateString();
        if (today !== lastTradeDay) {
            this.dailyTradeCount = 0;
            this.lastTradeDate = new Date();
        }
        this.dailyTradeCount++;
    }
}
exports.executionEngine = new ExecutionEngine();
