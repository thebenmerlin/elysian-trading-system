/**
 * Elysian Trading System - Portfolio Manager
 * Comprehensive portfolio tracking and performance analytics
 */

import { logger } from '@/utils/logger';
import { DatabaseManager } from '@/utils/database';
import { Trade, Position } from '@/execution';

export interface PortfolioSnapshot {
  timestamp: Date;
  total_value: number;
  cash: number;
  positions_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_pnl: number;
  daily_pnl: number;
  positions: Position[];
  metrics: PerformanceMetrics;
  allocation: { [symbol: string]: number }; // Percentage allocation
}

export interface PerformanceMetrics {
  total_return_pct: number;
  annualized_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  profit_factor: number;
  avg_trade_pnl: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  largest_winner: number;
  largest_loser: number;
  avg_holding_period_days: number;
  volatility_pct: number;
  calmar_ratio: number;
}

export class PortfolioManager {
  private initialCash: number;

  constructor() {
    this.initialCash = parseFloat(process.env.INITIAL_CASH || '100000');
  }

  async createPortfolioSnapshot(): Promise<PortfolioSnapshot> {
    try {
      const positions = await this.getCurrentPositions();
      const cash = await this.getCurrentCash();
      const trades = await this.getAllTrades();

      const positions_value = positions.reduce((sum, pos) => sum + pos.market_value, 0);
      const total_value = cash + positions_value;
      const unrealized_pnl = positions.reduce((sum, pos) => sum + pos.unrealized_pnl, 0);
      const realized_pnl = await this.getRealizedPnL();
      const total_pnl = realized_pnl + unrealized_pnl;
      const daily_pnl = await this.getDailyPnL();

      // Calculate metrics
      const metrics = await this.calculatePerformanceMetrics(trades, total_value);

      // Calculate allocation percentages
      const allocation: { [symbol: string]: number } = {};
      positions.forEach(pos => {
        allocation[pos.symbol] = (pos.market_value / total_value) * 100;
      });

      const snapshot: PortfolioSnapshot = {
        timestamp: new Date(),
        total_value,
        cash,
        positions_value,
        unrealized_pnl,
        realized_pnl,
        total_pnl,
        daily_pnl,
        positions,
        metrics,
        allocation
      };

      // Store snapshot
      await this.storePortfolioSnapshot(snapshot);

      logger.info('Portfolio snapshot created', {
        total_value,
        total_pnl,
        total_return_pct: metrics.total_return_pct,
        positions_count: positions.length
      });

      return snapshot;

    } catch (error) {
      logger.error('Failed to create portfolio snapshot:', error);
      throw error;
    }
  }

  private async getCurrentPositions(): Promise<Position[]> {
    try {
      const query = `
        SELECT p.symbol, p.quantity, p.avg_price, p.first_purchase, p.last_update,
               m.close as current_price
        FROM positions p
        LEFT JOIN LATERAL (
          SELECT close
          FROM market_data md
          WHERE md.symbol = p.symbol
          ORDER BY timestamp DESC
          LIMIT 1
        ) m ON true
        WHERE p.quantity != 0
      `;

      const result = await DatabaseManager.query(query, []);

      return result.rows.map((row: any) => {
        const quantity = parseInt(row.quantity);
        const avg_price = parseFloat(row.avg_price);
        const current_price = parseFloat(row.current_price || row.avg_price);
        const market_value = Math.abs(quantity) * current_price;
        const unrealized_pnl = (current_price - avg_price) * quantity;
        const unrealized_pnl_pct = (unrealized_pnl / (avg_price * Math.abs(quantity))) * 100;

        return {
          symbol: row.symbol,
          quantity,
          avg_price,
          current_price,
          market_value,
          unrealized_pnl,
          unrealized_pnl_pct,
          first_purchase: new Date(row.first_purchase),
          last_update: new Date(row.last_update)
        };
      });

    } catch (error) {
      logger.error('Failed to get current positions:', error);
      return [];
    }
  }

  private async getCurrentCash(): Promise<number> {
    try {
      // Calculate cash as initial cash minus all trade costs plus realized profits
      const trades = await this.getAllTrades();

      let cashUsed = 0;
      let commissions = 0;

      trades.forEach(trade => {
        const tradeCost = trade.quantity * trade.executed_price;
        if (trade.side === 'BUY') {
          cashUsed += tradeCost;
        } else {
          cashUsed -= tradeCost;
        }
        commissions += trade.commission;
      });

      return this.initialCash - cashUsed - commissions;

    } catch (error) {
      logger.error('Failed to calculate current cash:', error);
      return this.initialCash;
    }
  }

  private async getAllTrades(): Promise<Trade[]> {
    try {
      const query = `
        SELECT id, symbol, side, quantity, price, executed_price, timestamp,
               status, commission, metadata
        FROM trades
        WHERE status = 'FILLED'
        ORDER BY timestamp ASC
      `;

      const result = await DatabaseManager.query(query, []);

      return result.rows.map((row: any) => ({
        id: row.id,
        symbol: row.symbol,
        side: row.side,
        quantity: parseInt(row.quantity),
        price: parseFloat(row.price),
        executed_price: parseFloat(row.executed_price),
        timestamp: new Date(row.timestamp),
        status: row.status,
        commission: parseFloat(row.commission),
        metadata: JSON.parse(row.metadata || '{}')
      }));

    } catch (error) {
      logger.error('Failed to get all trades:', error);
      return [];
    }
  }

  private async getRealizedPnL(): Promise<number> {
    try {
      // Calculate realized P&L from closed positions
      const query = `
        SELECT symbol, side, quantity, executed_price, timestamp
        FROM trades
        WHERE status = 'FILLED'
        ORDER BY symbol, timestamp
      `;

      const result = await DatabaseManager.query(query, []);
      const trades = result.rows;

      let realizedPnL = 0;
      const positions: { [symbol: string]: { quantity: number; avgPrice: number } } = {};

      for (const trade of trades) {
        const symbol = trade.symbol;
        const side = trade.side;
        const quantity = parseInt(trade.quantity);
        const price = parseFloat(trade.executed_price);

        if (!positions[symbol]) {
          positions[symbol] = { quantity: 0, avgPrice: 0 };
        }

        const pos = positions[symbol];

        if (side === 'BUY') {
          // Update average price
          if (pos.quantity >= 0) {
            const totalCost = pos.avgPrice * pos.quantity + price * quantity;
            const totalQuantity = pos.quantity + quantity;
            pos.avgPrice = totalCost / totalQuantity;
            pos.quantity = totalQuantity;
          } else {
            // Covering short position
            const closingQuantity = Math.min(quantity, Math.abs(pos.quantity));
            realizedPnL += (pos.avgPrice - price) * closingQuantity;
            pos.quantity += quantity;
          }
        } else { // SELL
          if (pos.quantity > 0) {
            // Closing long position
            const closingQuantity = Math.min(quantity, pos.quantity);
            realizedPnL += (price - pos.avgPrice) * closingQuantity;
            pos.quantity -= quantity;
          } else {
            // Opening/adding to short position
            if (pos.quantity < 0) {
              const totalCost = pos.avgPrice * Math.abs(pos.quantity) + price * quantity;
              const totalQuantity = Math.abs(pos.quantity) + quantity;
              pos.avgPrice = totalCost / totalQuantity;
              pos.quantity = -totalQuantity;
            } else {
              pos.avgPrice = price;
              pos.quantity = -quantity;
            }
          }
        }
      }

      return realizedPnL;

    } catch (error) {
      logger.error('Failed to calculate realized P&L:', error);
      return 0;
    }
  }

  private async getDailyPnL(): Promise<number> {
    try {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Get today's and yesterday's snapshots
      const query = `
        SELECT total_value, timestamp
        FROM portfolio_snapshots
        WHERE timestamp >= $1
        ORDER BY timestamp DESC
        LIMIT 2
      `;

      const result = await DatabaseManager.query(query, [yesterday.toISOString()]);

      if (result.rows.length >= 2) {
        const today_value = parseFloat(result.rows[0].total_value);
        const yesterday_value = parseFloat(result.rows[1].total_value);
        return today_value - yesterday_value;
      }

      return 0;

    } catch (error) {
      logger.error('Failed to calculate daily P&L:', error);
      return 0;
    }
  }

  private async calculatePerformanceMetrics(trades: Trade[], currentValue: number): Promise<PerformanceMetrics> {
    try {
      if (trades.length === 0) {
        return this.getEmptyMetrics();
      }

      // Basic metrics
      const total_return_pct = ((currentValue - this.initialCash) / this.initialCash) * 100;

      // Trade analysis
      const tradePnLs = await this.calculateTradePnLs(trades);
      const total_trades = tradePnLs.length;
      const winning_trades = tradePnLs.filter(pnl => pnl > 0).length;
      const losing_trades = tradePnLs.filter(pnl => pnl < 0).length;
      const win_rate_pct = total_trades > 0 ? (winning_trades / total_trades) * 100 : 0;

      const gross_profits = tradePnLs.filter(pnl => pnl > 0).reduce((sum, pnl) => sum + pnl, 0);
      const gross_losses = Math.abs(tradePnLs.filter(pnl => pnl < 0).reduce((sum, pnl) => sum + pnl, 0));
      const profit_factor = gross_losses > 0 ? gross_profits / gross_losses : gross_profits > 0 ? 999 : 1;

      const avg_trade_pnl = total_trades > 0 ? tradePnLs.reduce((sum, pnl) => sum + pnl, 0) / total_trades : 0;
      const largest_winner = tradePnLs.length > 0 ? Math.max(...tradePnLs) : 0;
      const largest_loser = tradePnLs.length > 0 ? Math.min(...tradePnLs) : 0;

      // Time-based metrics
      const daysSinceStart = trades.length > 0 
        ? (Date.now() - trades[0].timestamp.getTime()) / (1000 * 60 * 60 * 24)
        : 1;
      const annualized_return_pct = total_return_pct * (365 / Math.max(daysSinceStart, 1));

      // Calculate volatility and drawdown from portfolio snapshots
      const { volatility_pct, max_drawdown_pct, sharpe_ratio } = await this.calculateRiskMetrics(currentValue);

      // Calmar ratio
      const calmar_ratio = max_drawdown_pct > 0 ? annualized_return_pct / max_drawdown_pct : 0;

      // Average holding period
      const avg_holding_period_days = await this.calculateAvgHoldingPeriod(trades);

      return {
        total_return_pct,
        annualized_return_pct,
        sharpe_ratio,
        max_drawdown_pct,
        win_rate_pct,
        profit_factor,
        avg_trade_pnl,
        total_trades,
        winning_trades,
        losing_trades,
        largest_winner,
        largest_loser,
        avg_holding_period_days,
        volatility_pct,
        calmar_ratio
      };

    } catch (error) {
      logger.error('Failed to calculate performance metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  private async calculateTradePnLs(trades: Trade[]): Promise<number[]> {
    // Simplified P&L calculation - pairs buy/sell trades
    const tradePnLs: number[] = [];
    const positions: { [symbol: string]: { quantity: number; avgPrice: number; trades: Trade[] } } = {};

    for (const trade of trades) {
      const symbol = trade.symbol;

      if (!positions[symbol]) {
        positions[symbol] = { quantity: 0, avgPrice: 0, trades: [] };
      }

      const pos = positions[symbol];
      pos.trades.push(trade);

      if (trade.side === 'BUY') {
        if (pos.quantity >= 0) {
          // Adding to long or opening long
          const totalCost = pos.avgPrice * pos.quantity + trade.executed_price * trade.quantity;
          const totalQuantity = pos.quantity + trade.quantity;
          pos.avgPrice = totalCost / totalQuantity;
          pos.quantity = totalQuantity;
        } else {
          // Covering short
          const closingQuantity = Math.min(trade.quantity, Math.abs(pos.quantity));
          const pnl = (pos.avgPrice - trade.executed_price) * closingQuantity - trade.commission;
          if (closingQuantity > 0) tradePnLs.push(pnl);
          pos.quantity += trade.quantity;
        }
      } else {
        if (pos.quantity > 0) {
          // Closing long
          const closingQuantity = Math.min(trade.quantity, pos.quantity);
          const pnl = (trade.executed_price - pos.avgPrice) * closingQuantity - trade.commission;
          if (closingQuantity > 0) tradePnLs.push(pnl);
          pos.quantity -= trade.quantity;
        } else {
          // Opening/adding short
          if (pos.quantity < 0) {
            const totalCost = pos.avgPrice * Math.abs(pos.quantity) + trade.executed_price * trade.quantity;
            const totalQuantity = Math.abs(pos.quantity) + trade.quantity;
            pos.avgPrice = totalCost / totalQuantity;
            pos.quantity = -totalQuantity;
          } else {
            pos.avgPrice = trade.executed_price;
            pos.quantity = -trade.quantity;
          }
        }
      }
    }

    return tradePnLs;
  }

  private async calculateRiskMetrics(currentValue: number): Promise<{
    volatility_pct: number;
    max_drawdown_pct: number;
    sharpe_ratio: number;
  }> {
    try {
      const query = `
        SELECT total_value, timestamp
        FROM portfolio_snapshots
        WHERE timestamp >= NOW() - INTERVAL '90 days'
        ORDER BY timestamp ASC
      `;

      const result = await DatabaseManager.query(query, []);
      const snapshots = result.rows.map(row => ({
        value: parseFloat(row.total_value),
        timestamp: new Date(row.timestamp)
      }));

      if (snapshots.length < 2) {
        return { volatility_pct: 0, max_drawdown_pct: 0, sharpe_ratio: 0 };
      }

      // Calculate daily returns
      const returns: number[] = [];
      for (let i = 1; i < snapshots.length; i++) {
        const dailyReturn = (snapshots[i].value - snapshots[i-1].value) / snapshots[i-1].value;
        returns.push(dailyReturn);
      }

      // Volatility
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      const volatility_pct = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized

      // Max drawdown
      let maxDrawdown = 0;
      let peak = snapshots[0].value;

      for (const snapshot of snapshots) {
        if (snapshot.value > peak) {
          peak = snapshot.value;
        }
        const drawdown = (peak - snapshot.value) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
      const max_drawdown_pct = maxDrawdown * 100;

      // Sharpe ratio (assuming risk-free rate of 2%)
      const riskFreeRate = 0.02 / 252; // Daily risk-free rate
      const excessReturns = returns.map(r => r - riskFreeRate);
      const avgExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
      const excessReturnStd = Math.sqrt(
        excessReturns.reduce((sum, r) => sum + Math.pow(r - avgExcessReturn, 2), 0) / excessReturns.length
      );
      const sharpe_ratio = excessReturnStd > 0 ? (avgExcessReturn / excessReturnStd) * Math.sqrt(252) : 0;

      return { volatility_pct, max_drawdown_pct, sharpe_ratio };

    } catch (error) {
      logger.error('Failed to calculate risk metrics:', error);
      return { volatility_pct: 20, max_drawdown_pct: 5, sharpe_ratio: 0 };
    }
  }

  private async calculateAvgHoldingPeriod(trades: Trade[]): Promise<number> {
    // Simplified - calculate time between first buy and last sell for each symbol
    const holdingPeriods: number[] = [];
    const symbolTrades: { [symbol: string]: Trade[] } = {};

    // Group trades by symbol
    trades.forEach(trade => {
      if (!symbolTrades[trade.symbol]) {
        symbolTrades[trade.symbol] = [];
      }
      symbolTrades[trade.symbol].push(trade);
    });

    // Calculate holding periods
    Object.values(symbolTrades).forEach(symbolTradeList => {
      const sortedTrades = symbolTradeList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      let position = 0;
      let entryTime: Date | null = null;

      for (const trade of sortedTrades) {
        if (position === 0) {
          entryTime = trade.timestamp;
        }

        position += trade.side === 'BUY' ? trade.quantity : -trade.quantity;

        if (position === 0 && entryTime) {
          // Position closed
          const holdingDays = (trade.timestamp.getTime() - entryTime.getTime()) / (1000 * 60 * 60 * 24);
          holdingPeriods.push(holdingDays);
          entryTime = null;
        }
      }
    });

    return holdingPeriods.length > 0 
      ? holdingPeriods.reduce((sum, days) => sum + days, 0) / holdingPeriods.length
      : 0;
  }

  private getEmptyMetrics(): PerformanceMetrics {
    return {
      total_return_pct: 0,
      annualized_return_pct: 0,
      sharpe_ratio: 0,
      max_drawdown_pct: 0,
      win_rate_pct: 0,
      profit_factor: 1,
      avg_trade_pnl: 0,
      total_trades: 0,
      winning_trades: 0,
      losing_trades: 0,
      largest_winner: 0,
      largest_loser: 0,
      avg_holding_period_days: 0,
      volatility_pct: 0,
      calmar_ratio: 0
    };
  }

  private async storePortfolioSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    try {
      const query = `
        INSERT INTO portfolio_snapshots (
          timestamp, total_value, cash, positions_value, unrealized_pnl,
          realized_pnl, total_pnl, daily_pnl, positions, metrics, allocation
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (timestamp) DO UPDATE SET
          total_value = EXCLUDED.total_value,
          cash = EXCLUDED.cash,
          positions_value = EXCLUDED.positions_value,
          unrealized_pnl = EXCLUDED.unrealized_pnl,
          realized_pnl = EXCLUDED.realized_pnl,
          total_pnl = EXCLUDED.total_pnl,
          daily_pnl = EXCLUDED.daily_pnl,
          positions = EXCLUDED.positions,
          metrics = EXCLUDED.metrics,
          allocation = EXCLUDED.allocation
      `;

      await DatabaseManager.query(query, [
        snapshot.timestamp,
        snapshot.total_value,
        snapshot.cash,
        snapshot.positions_value,
        snapshot.unrealized_pnl,
        snapshot.realized_pnl,
        snapshot.total_pnl,
        snapshot.daily_pnl,
        JSON.stringify(snapshot.positions),
        JSON.stringify(snapshot.metrics),
        JSON.stringify(snapshot.allocation)
      ]);

    } catch (error) {
      logger.error('Failed to store portfolio snapshot:', error);
      throw error;
    }
  }

  async getPortfolioHistory(days: number = 30): Promise<PortfolioSnapshot[]> {
    try {
      const query = `
        SELECT *
        FROM portfolio_snapshots
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY timestamp DESC
      `;

      const result = await DatabaseManager.query(query, []);

      return result.rows.map((row: any) => ({
        timestamp: new Date(row.timestamp),
        total_value: parseFloat(row.total_value),
        cash: parseFloat(row.cash),
        positions_value: parseFloat(row.positions_value),
        unrealized_pnl: parseFloat(row.unrealized_pnl),
        realized_pnl: parseFloat(row.realized_pnl),
        total_pnl: parseFloat(row.total_pnl),
        daily_pnl: parseFloat(row.daily_pnl),
        positions: JSON.parse(row.positions || '[]'),
        metrics: JSON.parse(row.metrics || '{}'),
        allocation: JSON.parse(row.allocation || '{}')
      }));

    } catch (error) {
      logger.error('Failed to get portfolio history:', error);
      return [];
    }
  }

  async getLatestPortfolioSnapshot(): Promise<PortfolioSnapshot | null> {
    try {
      const query = `
        SELECT *
        FROM portfolio_snapshots
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = await DatabaseManager.query(query, []);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        timestamp: new Date(row.timestamp),
        total_value: parseFloat(row.total_value),
        cash: parseFloat(row.cash),
        positions_value: parseFloat(row.positions_value),
        unrealized_pnl: parseFloat(row.unrealized_pnl),
        realized_pnl: parseFloat(row.realized_pnl),
        total_pnl: parseFloat(row.total_pnl),
        daily_pnl: parseFloat(row.daily_pnl),
        positions: JSON.parse(row.positions || '[]'),
        metrics: JSON.parse(row.metrics || '{}'),
        allocation: JSON.parse(row.allocation || '{}')
      };

    } catch (error) {
      logger.error('Failed to get latest portfolio snapshot:', error);
      return null;
    }
  }
}

export const portfolioManager = new PortfolioManager();
