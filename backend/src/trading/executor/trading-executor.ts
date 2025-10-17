/**
 * Autonomous Trade Execution Engine
 */
import { logger } from '../../utils/logger';
import { DatabaseManager } from '../../utils/database';
import { EventEmitter } from 'events';
import { AISignal } from '../../ai/reasoning/decision-engine';

export interface ExecutedTrade {
  id?: number;
  symbol: string;
  asset_type: 'crypto' | 'equity';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total_value: number;
  reasoning: string;
  confidence: number;
  timestamp: Date;
  pnl_realized?: number;
  signal_id?: number;
}

export interface PortfolioPosition {
  symbol: string;
  asset_type: 'crypto' | 'equity';
  quantity: number;
  avg_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
}

export class TradeExecutor extends EventEmitter {
  private maxPositionSize = 0.05; // 5% of portfolio per position
  private maxTotalExposure = 0.8; // 80% of portfolio in positions
  private minCashReserve = 0.2; // 20% cash reserve
  private riskPerTrade = 0.02; // 2% risk per trade

  constructor() {
    super();
  }

  async executeSignal(signal: AISignal): Promise<ExecutedTrade | null> {
    try {
      logger.info(`⚡ Executing signal: ${signal.signal_type} ${signal.symbol} (${signal.confidence.toFixed(2)})`);

      // Risk checks
      const riskCheck = await this.performRiskChecks(signal);
      if (!riskCheck.approved) {
        logger.warn(`❌ Trade rejected: ${riskCheck.reason}`);
        return null;
      }

      // Calculate position size
      const positionSize = await this.calculatePositionSize(signal);
      if (positionSize <= 0) {
        logger.warn(`❌ Invalid position size for ${signal.symbol}`);
        return null;
      }

      // Execute the trade
      const trade = await this.executeTrade(signal, positionSize);
      
      if (trade) {
        // Update portfolio
        await this.updatePortfolio(trade);
        
        // Mark signal as executed
        await this.markSignalExecuted(signal);
        
        // Emit trade event
        this.emit('trade_executed', trade);
        
        // Log system event
        await this.logTradeEvent(trade);
        
        logger.info(`✅ Trade executed: ${trade.side} ${trade.quantity} ${trade.symbol} @ $${trade.price}`);
      }

      return trade;

    } catch (error) {
      logger.error('Error executing signal:', error);
      return null;
    }
  }

  private async performRiskChecks(signal: AISignal): Promise<{ approved: boolean; reason?: string }> {
    try {
      // Check confidence threshold
      if (signal.confidence < 0.6) {
        return { approved: false, reason: 'Confidence below threshold' };
      }

      // Check portfolio exposure
      const portfolioValue = await this.getPortfolioValue();
      const currentExposure = await this.getCurrentExposure();
      
      if (currentExposure / portfolioValue > this.maxTotalExposure) {
        return { approved: false, reason: 'Portfolio exposure limit exceeded' };
      }

      // Check position concentration
      const existingPosition = await this.getPosition(signal.symbol, signal.asset_type);
      const currentPositionValue = existingPosition ? existingPosition.market_value : 0;
      const maxPositionValue = portfolioValue * this.maxPositionSize;
      
      if (signal.signal_type === 'BUY' && currentPositionValue >= maxPositionValue) {
        return { approved: false, reason: 'Position size limit exceeded' };
      }

      // Check cash availability
      const cashBalance = await this.getCashBalance();
      const minCash = portfolioValue * this.minCashReserve;
      
      if (signal.signal_type === 'BUY' && cashBalance <= minCash) {
        return { approved: false, reason: 'Insufficient cash reserve' };
      }

      // Check for recent trades (avoid overtrading)
      const recentTrades = await this.getRecentTrades(signal.symbol, 1); // Last 1 hour
      if (recentTrades.length >= 3) {
        return { approved: false, reason: 'Too many recent trades for this symbol' };
      }

      return { approved: true };

    } catch (error) {
      logger.error('Error in risk checks:', error);
      return { approved: false, reason: 'Risk check system error' };
    }
  }

  private async calculatePositionSize(signal: AISignal): Promise<number> {
    try {
      const portfolioValue = await this.getPortfolioValue();
      const cashBalance = await this.getCashBalance();
      const currentPrice = signal.price_at_signal;

      if (signal.signal_type === 'BUY') {
        // Calculate position size based on risk
        const riskAmount = portfolioValue * this.riskPerTrade;
        const stopLossDistance = signal.stop_loss ? Math.abs(currentPrice - signal.stop_loss) : currentPrice * 0.05;
        
        let quantity = riskAmount / stopLossDistance;
        
        // Limit by max position size
        const maxPositionValue = portfolioValue * this.maxPositionSize;
        const maxQuantity = maxPositionValue / currentPrice;
        quantity = Math.min(quantity, maxQuantity);
        
        // Limit by available cash
        const maxAffordableQuantity = (cashBalance * 0.95) / currentPrice; // Leave 5% buffer
        quantity = Math.min(quantity, maxAffordableQuantity);
        
        return Math.max(0, quantity);

      } else if (signal.signal_type === 'SELL') {
        // Sell existing position
        const position = await this.getPosition(signal.symbol, signal.asset_type);
        return position ? position.quantity : 0;
      }

      return 0;

    } catch (error) {
      logger.error('Error calculating position size:', error);
      return 0;
    }
  }

  private async executeTrade(signal: AISignal, quantity: number): Promise<ExecutedTrade | null> {
    try {
      // Ignore HOLD signals at execution level to ensure trade side is only BUY or SELL
      if (signal.signal_type === 'HOLD') {
        logger.info(`⏸️ Hold signal received for ${signal.symbol}; no execution.`);
        return null;
      }

      const currentPrice = await this.getCurrentPrice(signal.symbol, signal.asset_type);
      const totalValue = quantity * currentPrice;

      // Add slippage simulation (0.1% for crypto, 0.05% for equity)
      const slippage = signal.asset_type === 'crypto' ? 0.001 : 0.0005;
      const executionPrice = signal.signal_type === 'BUY' 
        ? currentPrice * (1 + slippage)
        : currentPrice * (1 - slippage);

      const actualTotalValue = quantity * executionPrice;

      // Calculate realized PnL for SELL orders
      let realizedPnL = 0;
      if (signal.signal_type === 'SELL') {
        const position = await this.getPosition(signal.symbol, signal.asset_type);
        if (position) {
          realizedPnL = (executionPrice - position.avg_price) * quantity;
        }
      }

      const trade: ExecutedTrade = {
        symbol: signal.symbol,
        asset_type: signal.asset_type,
        side: signal.signal_type,
        quantity,
        price: executionPrice,
        total_value: actualTotalValue,
        reasoning: signal.reasoning,
        confidence: signal.confidence,
        timestamp: new Date(),
        pnl_realized: realizedPnL
      };

      // Store trade in database
      const query = `
        INSERT INTO trades_executed (
          symbol, asset_type, side, quantity, price, total_value, 
          reasoning, confidence, timestamp, pnl_realized, signal_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;

      const result = await DatabaseManager.query(query, [
        trade.symbol,
        trade.asset_type,
        trade.side,
        trade.quantity,
        trade.price,
        trade.total_value,
        trade.reasoning,
        trade.confidence,
        trade.timestamp,
        trade.pnl_realized,
        signal.features ? 1 : null // Would need signal_id from actual signal
      ]);

      trade.id = result.rows[0].id;
      return trade;

    } catch (error) {
      logger.error('Error executing trade:', error);
      return null;
    }
  }

  private async updatePortfolio(trade: ExecutedTrade): Promise<void> {
    try {
      if (trade.side === 'BUY') {
        // Add to or create position
        const query = `
          INSERT INTO portfolio_live (symbol, asset_type, quantity, avg_price, last_updated)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (symbol, asset_type) DO UPDATE SET
            quantity = portfolio_live.quantity + EXCLUDED.quantity,
            avg_price = (
              (portfolio_live.quantity * portfolio_live.avg_price) + 
              (EXCLUDED.quantity * EXCLUDED.avg_price)
            ) / (portfolio_live.quantity + EXCLUDED.quantity),
            last_updated = NOW()
        `;

        await DatabaseManager.query(query, [
          trade.symbol,
          trade.asset_type,
          trade.quantity,
          trade.price
        ]);

      } else if (trade.side === 'SELL') {
        // Reduce position
        const query = `
          UPDATE portfolio_live 
          SET 
            quantity = quantity - $3,
            last_updated = NOW()
          WHERE symbol = $1 AND asset_type = $2
        `;

        await DatabaseManager.query(query, [
          trade.symbol,
          trade.asset_type,
          trade.quantity
        ]);

        // Remove position if quantity becomes 0 or negative
        await DatabaseManager.query(
          `DELETE FROM portfolio_live WHERE quantity <= 0`
        );
      }

      // Update position market values
      await this.updatePortfolioValues();

    } catch (error) {
      logger.error('Error updating portfolio:', error);
      throw error;
    }
  }

  private async updatePortfolioValues(): Promise<void> {
    try {
      const query = `
        UPDATE portfolio_live 
        SET 
          current_price = al.price,
          market_value = portfolio_live.quantity * al.price,
          unrealized_pnl = (al.price - portfolio_live.avg_price) * portfolio_live.quantity,
          last_updated = NOW()
        FROM assets_live al
        WHERE portfolio_live.symbol = al.symbol 
          AND portfolio_live.asset_type = al.asset_type
      `;

      await DatabaseManager.query(query);
    } catch (error) {
      logger.error('Error updating portfolio values:', error);
    }
  }

  private async markSignalExecuted(signal: AISignal): Promise<void> {
    try {
      // This would need the actual signal ID from the database
      // For now, we'll mark recent signals as executed
      const query = `
        UPDATE ai_signals 
        SET executed = true 
        WHERE symbol = $1 
          AND asset_type = $2 
          AND signal_type = $3 
          AND executed = false 
          AND timestamp > NOW() - INTERVAL '1 hour'
      `;

      await DatabaseManager.query(query, [
        signal.symbol,
        signal.asset_type,
        signal.signal_type
      ]);
    } catch (error) {
      logger.error('Error marking signal as executed:', error);
    }
  }

  private async logTradeEvent(trade: ExecutedTrade): Promise<void> {
    try {
      const query = `
        INSERT INTO system_events (event_type, event_data, severity)
        VALUES ('TRADE_EXECUTED', $1, 'INFO')
      `;

      await DatabaseManager.query(query, [JSON.stringify({
        trade_id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price,
        total_value: trade.total_value,
        pnl_realized: trade.pnl_realized
      })]);
    } catch (error) {
      logger.error('Error logging trade event:', error);
    }
  }

  // Helper methods
  private async getPortfolioValue(): Promise<number> {
    try {
      const query = `
        SELECT 
          COALESCE(SUM(market_value), 0) as total_positions,
          (SELECT COALESCE(cash_balance, 100000) FROM portfolio_snapshots_live ORDER BY timestamp DESC LIMIT 1) as cash
        FROM portfolio_live
      `;
      
      const result = await DatabaseManager.query(query);
      const positions = parseFloat(result.rows[0].total_positions || 0);
      const cash = parseFloat(result.rows[0].cash || 100000);
      
      return positions + cash;
    } catch (error) {
      logger.error('Error getting portfolio value:', error);
      return 100000; // Default initial value
    }
  }

  private async getCurrentExposure(): Promise<number> {
    try {
      const query = `SELECT COALESCE(SUM(market_value), 0) as total FROM portfolio_live`;
      const result = await DatabaseManager.query(query);
      return parseFloat(result.rows[0].total || 0);
    } catch (error) {
      logger.error('Error getting current exposure:', error);
      return 0;
    }
  }

  private async getCashBalance(): Promise<number> {
    try {
      // Calculate cash from initial amount minus trade costs
      const initialCash = 100000; // Should come from config
      
      const query = `
        SELECT COALESCE(SUM(
          CASE 
            WHEN side = 'BUY' THEN -total_value
            WHEN side = 'SELL' THEN total_value
          END
        ), 0) as net_cash_flow
        FROM trades_executed
      `;
      
      const result = await DatabaseManager.query(query);
      const netCashFlow = parseFloat(result.rows[0].net_cash_flow || 0);
      
      return initialCash + netCashFlow;
    } catch (error) {
      logger.error('Error getting cash balance:', error);
      return 100000;
    }
  }

  private async getPosition(symbol: string, assetType: 'crypto' | 'equity'): Promise<PortfolioPosition | null> {
    try {
      const query = `
        SELECT * FROM portfolio_live 
        WHERE symbol = $1 AND asset_type = $2
      `;
      
      const result = await DatabaseManager.query(query, [symbol, assetType]);
      
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        symbol: row.symbol,
        asset_type: row.asset_type,
        quantity: parseFloat(row.quantity),
        avg_price: parseFloat(row.avg_price),
        current_price: parseFloat(row.current_price || row.avg_price),
        market_value: parseFloat(row.market_value || 0),
        unrealized_pnl: parseFloat(row.unrealized_pnl || 0)
      };
    } catch (error) {
      logger.error('Error getting position:', error);
      return null;
    }
  }

  private async getCurrentPrice(symbol: string, assetType: 'crypto' | 'equity'): Promise<number> {
    try {
      const query = `
        SELECT price FROM assets_live 
        WHERE symbol = $1 AND asset_type = $2
      `;
      
      const result = await DatabaseManager.query(query, [symbol, assetType]);
      return result.rows.length > 0 ? parseFloat(result.rows[0].price) : 0;
    } catch (error) {
      logger.error('Error getting current price:', error);
      return 0;
    }
  }

  private async getRecentTrades(symbol: string, hours: number): Promise<ExecutedTrade[]> {
    try {
      const query = `
        SELECT * FROM trades_executed 
        WHERE symbol = $1 AND timestamp > NOW() - INTERVAL '${hours} hours'
        ORDER BY timestamp DESC
      `;
      
      const result = await DatabaseManager.query(query, [symbol]);
      
      return result.rows.map(row => ({
        id: row.id,
        symbol: row.symbol,
        asset_type: row.asset_type,
        side: row.side,
        quantity: parseFloat(row.quantity),
        price: parseFloat(row.price),
        total_value: parseFloat(row.total_value),
        reasoning: row.reasoning,
        confidence: parseFloat(row.confidence),
        timestamp: new Date(row.timestamp),
        pnl_realized: parseFloat(row.pnl_realized || 0)
      }));
    } catch (error) {
      logger.error('Error getting recent trades:', error);
      return [];
    }
  }
}

export const tradeExecutor = new TradeExecutor();
