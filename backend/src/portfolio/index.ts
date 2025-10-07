/**
 * Elysian Trading System - Portfolio Manager
 * Portfolio tracking and performance analytics
 */
import { logger } from '../utils/logger';
import { DatabaseManager } from '../utils/database';

export interface PortfolioSnapshot {
  id?: string;
  timestamp: Date;
  total_value: number;
  cash: number;
  positions_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
  total_pnl: number;
  daily_pnl: number;
  positions: any[];
  metrics: any;
  allocation: any;
}

class PortfolioManager {
  async getLatestPortfolioSnapshot(): Promise<PortfolioSnapshot | null> {
    try {
      const query = `
        SELECT * FROM portfolio_snapshots 
        ORDER BY timestamp DESC 
        LIMIT 1
      `;
      
      const result = await DatabaseManager.query(query);
      if (result.rows.length === 0) {
        // Create initial snapshot if none exists
        return await this.createPortfolioSnapshot();
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
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

  async getPortfolioHistory(days: number): Promise<PortfolioSnapshot[]> {
    try {
      const query = `
        SELECT * FROM portfolio_snapshots 
        WHERE timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY timestamp DESC
        LIMIT 100
      `;
      
      const result = await DatabaseManager.query(query);
      return result.rows.map((row: any) => ({
        id: row.id,
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

  async createPortfolioSnapshot(): Promise<PortfolioSnapshot> {
    try {
      const initialCash = parseFloat(process.env.INITIAL_CASH || '100000');

      
      // Get previous snapshot for comparison
      const previousSnapshot = await this.getPreviousSnapshot();
      const previousValue = previousSnapshot?.total_value || initialCash;
      
      // Calculate current portfolio value (mock calculation)
      const currentValue = initialCash + (Math.random() - 0.5) * 1000; // Random change for demo
      const dailyPnl = currentValue - previousValue;
      
      const snapshot: PortfolioSnapshot = {
        timestamp: new Date(),
        total_value: currentValue,
        cash: currentValue * 0.8, // 80% cash
        positions_value: currentValue * 0.2, // 20% positions
        unrealized_pnl: dailyPnl * 0.5,
        realized_pnl: dailyPnl * 0.5,
        total_pnl: dailyPnl,
        daily_pnl: dailyPnl,
        positions: [],
        metrics: {
          total_return_pct: ((currentValue - initialCash) / initialCash) * 100,
          sharpe_ratio: 0,
          max_drawdown_pct: 0,
          win_rate_pct: 0
        },
        allocation: {
          cash_pct: 80,
          equity_pct: 20
        }
      };

      // Store in database
      const query = `
        INSERT INTO portfolio_snapshots (
          timestamp, total_value, cash, positions_value, 
          unrealized_pnl, realized_pnl, total_pnl, daily_pnl, 
          positions, metrics, allocation
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;

      const result = await DatabaseManager.query(query, [
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

      snapshot.id = result.rows[0].id;
      logger.info('Portfolio snapshot created', {
        total_value: snapshot.total_value,
        daily_pnl: snapshot.daily_pnl
      });

      return snapshot;
    } catch (error) {
      logger.error('Failed to create portfolio snapshot:', error);
      throw error;
    }
  }

  private async getPreviousSnapshot(): Promise<PortfolioSnapshot | null> {
    try {
      const query = `
        SELECT * FROM portfolio_snapshots 
        ORDER BY timestamp DESC 
        LIMIT 1 OFFSET 1
      `;
      
      const result = await DatabaseManager.query(query);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        id: row.id,
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
      logger.error('Failed to get previous snapshot:', error);
      return null;
    }
  }
}

export const portfolioManager = new PortfolioManager();
