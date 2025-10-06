/**
 * Elysian Trading System - Execution Engine
 * Simulated trade execution with comprehensive risk management
 */

import { logger } from '@/utils/logger';
import { DatabaseManager } from '@/utils/database';
import { TradingSignal } from '@/signal_engine';
import { AIAnalysis } from '@/ai_reasoner';
import { v4 as uuidv4 } from 'uuid';

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executed_price: number;
  timestamp: Date;
  status: 'PENDING' | 'FILLED' | 'PARTIAL' | 'REJECTED' | 'CANCELLED';
  commission: number;
  signal_id?: string;
  ai_analysis_id?: string;
  metadata: {
    signal_strength: number;
    ai_confidence: number;
    risk_score: number;
    execution_reason: string;
    market_conditions: any;
  };
}

export interface Position {
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  first_purchase: Date;
  last_update: Date;
}

export interface ExecutionParams {
  max_position_size_pct: number; // % of portfolio
  max_daily_trades: number;
  min_confidence_threshold: number;
  min_signal_strength: number;
  risk_limit_pct: number; // Max portfolio risk
  commission_per_trade: number;
  slippage_pct: number;
}

export class ExecutionEngine {
  private params: ExecutionParams;
  private dailyTrades: number = 0;
  private lastResetDate: Date = new Date();

  constructor(params?: Partial<ExecutionParams>) {
    this.params = {
      max_position_size_pct: 10,
      max_daily_trades: 20,
      min_confidence_threshold: 0.6,
      min_signal_strength: 0.4,
      risk_limit_pct: 15,
      commission_per_trade: 1.0,
      slippage_pct: 0.05,
      ...params
    };
  }

  async evaluateAndExecute(
    signal: TradingSignal,
    aiAnalysis: AIAnalysis,
    currentPortfolioValue: number
  ): Promise<Trade | null> {
    try {
      // Reset daily trade counter if new day
      this.resetDailyCounterIfNeeded();

      // Pre-execution checks
      const canExecute = await this.preExecutionChecks(signal, aiAnalysis, currentPortfolioValue);
      if (!canExecute.allowed) {
        logger.info(`Trade rejected for ${signal.symbol}: ${canExecute.reason}`);
        return null;
      }

      // Calculate position size
      const positionSize = await this.calculatePositionSize(
        signal,
        aiAnalysis,
        currentPortfolioValue
      );

      if (positionSize <= 0) {
        logger.info(`Zero position size calculated for ${signal.symbol}`);
        return null;
      }

      // Execute the trade
      const trade = await this.executeTrade(
        signal,
        aiAnalysis,
        positionSize,
        currentPortfolioValue
      );

      if (trade && trade.status === 'FILLED') {
        this.dailyTrades++;
        logger.info(`Trade executed: ${trade.side} ${trade.quantity} ${trade.symbol} @ $${trade.executed_price}`, {
          trade_id: trade.id,
          signal_strength: signal.strength,
          ai_confidence: aiAnalysis.confidence
        });
      }

      return trade;

    } catch (error) {
      logger.error(`Execution failed for ${signal.symbol}:`, error);
      return null;
    }
  }

  private async preExecutionChecks(
    signal: TradingSignal,
    aiAnalysis: AIAnalysis,
    portfolioValue: number
  ): Promise<{ allowed: boolean; reason?: string }> {

    // Check if live trading is enabled
    if (process.env.ELYSIAN_LIVE !== 'true') {
      // Paper trading mode - always allow
      return { allowed: true };
    }

    // Daily trade limit
    if (this.dailyTrades >= this.params.max_daily_trades) {
      return { allowed: false, reason: 'Daily trade limit exceeded' };
    }

    // Signal quality checks
    if (signal.confidence < this.params.min_confidence_threshold) {
      return { allowed: false, reason: 'Signal confidence too low' };
    }

    if (signal.strength < this.params.min_signal_strength) {
      return { allowed: false, reason: 'Signal strength too low' };
    }

    // AI analysis alignment
    if (aiAnalysis.recommendation.action !== signal.signal_type) {
      return { allowed: false, reason: 'AI recommendation conflicts with signal' };
    }

    // Risk assessment
    if (aiAnalysis.risk_assessment.level === 'HIGH' && signal.risk_score > 0.8) {
      return { allowed: false, reason: 'Risk too high' };
    }

    // Portfolio risk limit
    const currentRisk = await this.calculateCurrentPortfolioRisk();
    if (currentRisk > this.params.risk_limit_pct / 100) {
      return { allowed: false, reason: 'Portfolio risk limit exceeded' };
    }

    // Check for existing position limits
    const currentPosition = await this.getCurrentPosition(signal.symbol);
    if (currentPosition) {
      const positionValue = Math.abs(currentPosition.quantity) * currentPosition.current_price;
      const positionPct = (positionValue / portfolioValue) * 100;

      if (positionPct > this.params.max_position_size_pct) {
        return { allowed: false, reason: 'Position size limit exceeded' };
      }
    }

    return { allowed: true };
  }

  private async calculatePositionSize(
    signal: TradingSignal,
    aiAnalysis: AIAnalysis,
    portfolioValue: number
  ): Promise<number> {

    // Base position size from AI recommendation
    let baseSizePct = aiAnalysis.recommendation.position_size_pct / 100;

    // Adjust based on signal strength and confidence
    const signalMultiplier = (signal.strength * signal.confidence);
    baseSizePct *= signalMultiplier;

    // Apply risk scaling
    const riskMultiplier = signal.risk_score < 0.5 ? 1.2 : signal.risk_score > 0.7 ? 0.6 : 1.0;
    baseSizePct *= riskMultiplier;

    // Ensure within limits
    const maxSizePct = this.params.max_position_size_pct / 100;
    const finalSizePct = Math.min(baseSizePct, maxSizePct);

    // Convert to dollar amount
    const positionValue = portfolioValue * finalSizePct;

    // Get current market price (simulate with slight slippage)
    const currentPrice = await this.getCurrentMarketPrice(signal.symbol);
    const executionPrice = signal.signal_type === 'BUY' 
      ? currentPrice * (1 + this.params.slippage_pct / 100)
      : currentPrice * (1 - this.params.slippage_pct / 100);

    // Calculate quantity (whole shares only)
    const quantity = Math.floor(positionValue / executionPrice);

    logger.debug(`Position sizing for ${signal.symbol}`, {
      base_size_pct: baseSizePct * 100,
      final_size_pct: finalSizePct * 100,
      position_value: positionValue,
      execution_price: executionPrice,
      quantity
    });

    return quantity;
  }

  private async executeTrade(
    signal: TradingSignal,
    aiAnalysis: AIAnalysis,
    quantity: number,
    portfolioValue: number
  ): Promise<Trade> {

    const currentPrice = await this.getCurrentMarketPrice(signal.symbol);

    // Simulate execution with slippage
    const executedPrice = signal.signal_type === 'BUY'
      ? currentPrice * (1 + this.params.slippage_pct / 100)
      : currentPrice * (1 - this.params.slippage_pct / 100);

    const trade: Trade = {
      id: uuidv4(),
      symbol: signal.symbol,
      side: signal.signal_type,
      quantity,
      price: currentPrice,
      executed_price: executedPrice,
      timestamp: new Date(),
      status: 'FILLED', // Simulate instant fill for now
      commission: this.params.commission_per_trade,
      signal_id: signal.id,
      metadata: {
        signal_strength: signal.strength,
        ai_confidence: aiAnalysis.confidence,
        risk_score: signal.risk_score,
        execution_reason: `Signal: ${signal.source}, AI: ${aiAnalysis.recommendation.action}`,
        market_conditions: aiAnalysis.market_context
      }
    };

    // Store trade in database
    await this.storeTrade(trade);

    // Update position
    await this.updatePosition(trade);

    return trade;
  }

  private async getCurrentMarketPrice(symbol: string): Promise<number> {
    try {
      const query = `
        SELECT close
        FROM market_data
        WHERE symbol = $1
        ORDER BY timestamp DESC
        LIMIT 1
      `;

      const result = await DatabaseManager.query(query, [symbol]);

      if (result.rows.length > 0) {
        return parseFloat(result.rows[0].close);
      } else {
        throw new Error(`No market data found for ${symbol}`);
      }
    } catch (error) {
      logger.error(`Failed to get market price for ${symbol}:`, error);
      throw error;
    }
  }

  private async getCurrentPosition(symbol: string): Promise<Position | null> {
    try {
      const query = `
        SELECT symbol, quantity, avg_price, current_price, market_value,
               unrealized_pnl, unrealized_pnl_pct, first_purchase, last_update
        FROM positions
        WHERE symbol = $1
      `;

      const result = await DatabaseManager.query(query, [symbol]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          symbol: row.symbol,
          quantity: parseInt(row.quantity),
          avg_price: parseFloat(row.avg_price),
          current_price: parseFloat(row.current_price),
          market_value: parseFloat(row.market_value),
          unrealized_pnl: parseFloat(row.unrealized_pnl),
          unrealized_pnl_pct: parseFloat(row.unrealized_pnl_pct),
          first_purchase: new Date(row.first_purchase),
          last_update: new Date(row.last_update)
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get position for ${symbol}:`, error);
      return null;
    }
  }

  private async calculateCurrentPortfolioRisk(): Promise<number> {
    try {
      // Simplified risk calculation based on position volatilities
      const query = `
        SELECT p.symbol, p.quantity, p.current_price, f.features->>'volatility_20' as volatility
        FROM positions p
        LEFT JOIN features f ON p.symbol = f.symbol
        WHERE p.quantity != 0
        ORDER BY f.timestamp DESC
      `;

      const result = await DatabaseManager.query(query, []);
      let totalRisk = 0;
      let totalValue = 0;

      for (const row of result.rows) {
        const positionValue = Math.abs(parseInt(row.quantity)) * parseFloat(row.current_price);
        const volatility = parseFloat(row.volatility || '20') / 100; // Convert % to decimal
        totalRisk += positionValue * volatility;
        totalValue += positionValue;
      }

      return totalValue > 0 ? totalRisk / totalValue : 0;

    } catch (error) {
      logger.error('Failed to calculate portfolio risk:', error);
      return 0.5; // Conservative fallback
    }
  }

  private async storeTrade(trade: Trade): Promise<void> {
    try {
      const query = `
        INSERT INTO trades (
          id, symbol, side, quantity, price, executed_price, timestamp,
          status, commission, signal_id, ai_analysis_id, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;

      await DatabaseManager.query(query, [
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

    } catch (error) {
      logger.error('Failed to store trade:', error);
      throw error;
    }
  }

  private async updatePosition(trade: Trade): Promise<void> {
    try {
      // Get current position or create new one
      let position = await this.getCurrentPosition(trade.symbol);
      const currentPrice = trade.executed_price;

      if (!position) {
        // New position
        position = {
          symbol: trade.symbol,
          quantity: trade.side === 'BUY' ? trade.quantity : -trade.quantity,
          avg_price: currentPrice,
          current_price: currentPrice,
          market_value: trade.quantity * currentPrice,
          unrealized_pnl: 0,
          unrealized_pnl_pct: 0,
          first_purchase: trade.timestamp,
          last_update: trade.timestamp
        };
      } else {
        // Update existing position
        const newQuantity = trade.side === 'BUY' 
          ? position.quantity + trade.quantity
          : position.quantity - trade.quantity;

        if (newQuantity === 0) {
          // Position closed - calculate realized P&L
          const realizedPnl = trade.side === 'SELL'
            ? (currentPrice - position.avg_price) * trade.quantity
            : (position.avg_price - currentPrice) * trade.quantity;

          // Delete position from database
          await DatabaseManager.query('DELETE FROM positions WHERE symbol = $1', [trade.symbol]);

          logger.info(`Position closed for ${trade.symbol}`, {
            realized_pnl: realizedPnl,
            avg_price: position.avg_price,
            exit_price: currentPrice
          });

          return;
        } else {
          // Update average price for same-side trades
          if ((trade.side === 'BUY' && position.quantity > 0) || 
              (trade.side === 'SELL' && position.quantity < 0)) {
            const totalCost = (position.avg_price * Math.abs(position.quantity)) + 
                            (currentPrice * trade.quantity);
            const totalQuantity = Math.abs(position.quantity) + trade.quantity;
            position.avg_price = totalCost / totalQuantity;
          }

          position.quantity = newQuantity;
          position.current_price = currentPrice;
          position.market_value = Math.abs(newQuantity) * currentPrice;
          position.unrealized_pnl = (currentPrice - position.avg_price) * newQuantity;
          position.unrealized_pnl_pct = (position.unrealized_pnl / (position.avg_price * Math.abs(newQuantity))) * 100;
          position.last_update = trade.timestamp;
        }
      }

      // Store/update position
      const query = `
        INSERT INTO positions (
          symbol, quantity, avg_price, current_price, market_value,
          unrealized_pnl, unrealized_pnl_pct, first_purchase, last_update
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (symbol) DO UPDATE SET
          quantity = EXCLUDED.quantity,
          avg_price = EXCLUDED.avg_price,
          current_price = EXCLUDED.current_price,
          market_value = EXCLUDED.market_value,
          unrealized_pnl = EXCLUDED.unrealized_pnl,
          unrealized_pnl_pct = EXCLUDED.unrealized_pnl_pct,
          last_update = EXCLUDED.last_update
      `;

      await DatabaseManager.query(query, [
        position.symbol,
        position.quantity,
        position.avg_price,
        position.current_price,
        position.market_value,
        position.unrealized_pnl,
        position.unrealized_pnl_pct,
        position.first_purchase,
        position.last_update
      ]);

    } catch (error) {
      logger.error('Failed to update position:', error);
      throw error;
    }
  }

  private resetDailyCounterIfNeeded(): void {
    const now = new Date();
    const lastReset = this.lastResetDate;

    if (now.toDateString() !== lastReset.toDateString()) {
      this.dailyTrades = 0;
      this.lastResetDate = now;
      logger.info('Daily trade counter reset');
    }
  }

  async getRecentTrades(limit: number = 50): Promise<Trade[]> {
    try {
      const query = `
        SELECT id, symbol, side, quantity, price, executed_price, timestamp,
               status, commission, signal_id, ai_analysis_id, metadata
        FROM trades
        ORDER BY timestamp DESC
        LIMIT $1
      `;

      const result = await DatabaseManager.query(query, [limit]);

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
        signal_id: row.signal_id,
        ai_analysis_id: row.ai_analysis_id,
        metadata: JSON.parse(row.metadata || '{}')
      }));

    } catch (error) {
      logger.error('Failed to get recent trades:', error);
      throw error;
    }
  }

  async getAllPositions(): Promise<Position[]> {
    try {
      const query = `
        SELECT symbol, quantity, avg_price, current_price, market_value,
               unrealized_pnl, unrealized_pnl_pct, first_purchase, last_update
        FROM positions
        WHERE quantity != 0
        ORDER BY market_value DESC
      `;

      const result = await DatabaseManager.query(query, []);

      return result.rows.map((row: any) => ({
        symbol: row.symbol,
        quantity: parseInt(row.quantity),
        avg_price: parseFloat(row.avg_price),
        current_price: parseFloat(row.current_price),
        market_value: parseFloat(row.market_value),
        unrealized_pnl: parseFloat(row.unrealized_pnl),
        unrealized_pnl_pct: parseFloat(row.unrealized_pnl_pct),
        first_purchase: new Date(row.first_purchase),
        last_update: new Date(row.last_update)
      }));

    } catch (error) {
      logger.error('Failed to get positions:', error);
      throw error;
    }
  }

  async updateExecutionParams(newParams: Partial<ExecutionParams>): Promise<void> {
    this.params = { ...this.params, ...newParams };
    logger.info('Execution parameters updated', this.params);
  }

  getExecutionParams(): ExecutionParams {
    return { ...this.params };
  }
}

export const executionEngine = new ExecutionEngine();
