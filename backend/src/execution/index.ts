/**
 * Elysian Trading System - Enhanced Execution Engine
 * Advanced position management with Kelly Criterion and risk controls
 */
import { logger } from '../utils/logger';
import { DatabaseManager } from '../utils/database';
import { portfolioManager } from '../portfolio';

export interface Trade {
  id?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executed_price: number;
  timestamp: Date;
  status: 'PENDING' | 'FILLED' | 'PARTIAL' | 'REJECTED' | 'CANCELLED';
  commission: number;
  slippage: number;
  signal_id?: string;
  ai_analysis_id?: string;
  metadata: {
    position_size_pct: number;
    kelly_fraction: number;
    risk_score: number;
    confidence: number;
    stop_loss?: number;
    take_profit?: number;
    expected_return: number;
    max_loss: number;
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
  allocation_pct: number;
  risk_contribution: number;
  stop_loss?: number;
  take_profit?: number;
  days_held: number;
}

export interface RiskMetrics {
  portfolio_var_95: number; // Value at Risk (95% confidence)
  portfolio_var_99: number; // Value at Risk (99% confidence)
  max_drawdown: number;
  sharpe_ratio: number;
  concentration_risk: number;
  leverage: number;
  beta: number;
}

class ExecutionEngine {
  private readonly MAX_POSITION_SIZE = 0.10; // 10% max per position
  private readonly MAX_PORTFOLIO_RISK = 0.20; // 20% max portfolio risk
  private readonly MIN_LIQUIDITY_REQUIREMENT = 0.05; // 5% cash minimum
  private readonly MAX_CORRELATION_EXPOSURE = 0.40; // 40% max in correlated assets
  private readonly COMMISSION_PER_TRADE = 1.0;
  private readonly MAX_DAILY_TRADES = 20;
  private dailyTradeCount: number = 0;
  private lastTradeDate: Date = new Date();

  // Kelly Criterion parameters (from backtesting)
  private readonly DEFAULT_WIN_RATE = 0.55;
  private readonly DEFAULT_AVG_WIN = 0.025;
  private readonly DEFAULT_AVG_LOSS = 0.018;

  async evaluateAndExecute(signal: any, aiAnalysis: any, portfolioValue: number): Promise<Trade | null> {
    try {
      logger.info(`🎯 Evaluating trade signal for ${signal.symbol}`, {
        signal_type: signal.signal_type,
        strength: signal.strength,
        confidence: signal.confidence,
        risk_score: signal.risk_score
      });

      // Pre-execution risk checks
      const riskChecks = await this.performRiskChecks(signal, portfolioValue);
      if (!riskChecks.approved) {
        logger.warn(`❌ Trade rejected for ${signal.symbol}: ${riskChecks.reason}`);
        return null;
      }

      // Calculate optimal position size using Kelly Criterion
      const positionSizing = await this.calculateOptimalPositionSize(signal, portfolioValue);
      if (positionSizing.quantity === 0) {
        logger.debug(`📏 Zero position size calculated for ${signal.symbol}`);
        return null;
      }

      // Get current market conditions for execution
      const executionPrice = await this.calculateExecutionPrice(signal);
      
      // Create trade with comprehensive metadata
      const trade: Trade = {
        id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol: signal.symbol,
        side: signal.signal_type as 'BUY' | 'SELL',
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

      // Execute the trade
      await this.executeTrade(trade);

      // Update position management
      await this.updatePortfolioPositions(trade);

      // Update daily trade count
      this.updateDailyTradeCount();

      logger.info(`✅ TRADE EXECUTED: ${trade.side} ${trade.quantity} ${trade.symbol} @ $${trade.executed_price.toFixed(2)}`, {
        position_size_pct: trade.metadata.position_size_pct,
        kelly_fraction: trade.metadata.kelly_fraction,
        expected_return: trade.metadata.expected_return,
        max_loss: trade.metadata.max_loss
      });

      return trade;

    } catch (error) {
      logger.error(`❌ Trade execution failed for ${signal.symbol}:`, error);
      return null;
    }
  }

  private async performRiskChecks(signal: any, portfolioValue: number): Promise<{ approved: boolean; reason?: string }> {
    try {
      // 1. Signal quality checks
      if (signal.confidence < 0.6) {
        return { approved: false, reason: `Low confidence: ${signal.confidence.toFixed(3)}` };
      }

      if (signal.risk_score > 0.8) {
        return { approved: false, reason: `High risk score: ${signal.risk_score.toFixed(3)}` };
      }

      if (signal.strength < 0.3) {
        return { approved: false, reason: `Weak signal strength: ${signal.strength.toFixed(3)}` };
      }

      // 2. Daily trade limits
      if (this.dailyTradeCount >= this.MAX_DAILY_TRADES) {
        return { approved: false, reason: 'Daily trade limit exceeded' };
      }

      // 3. Portfolio risk limits
      const currentPositions = await this.getCurrentPositions();
      const existingPosition = currentPositions.find(p => p.symbol === signal.symbol);

      // Check for position concentration
      if (!existingPosition) {
        const positionCount = currentPositions.length;
        if (positionCount >= 10) {
          return { approved: false, reason: 'Maximum position count reached (10)' };
        }
      }

      // 4. Liquidity check
      const cashRatio = await this.getCashRatio();
      if (cashRatio < this.MIN_LIQUIDITY_REQUIREMENT) {
        return { approved: false, reason: `Insufficient liquidity: ${(cashRatio * 100).toFixed(1)}%` };
      }

      // 5. Sector/correlation risk
      const sectorExposure = await this.calculateSectorExposure(signal.symbol, currentPositions);
      if (sectorExposure > this.MAX_CORRELATION_EXPOSURE) {
        return { approved: false, reason: `Sector exposure limit: ${(sectorExposure * 100).toFixed(1)}%` };
      }

      // 6. Portfolio VaR check
      const portfolioRisk = await this.calculatePortfolioVaR(currentPositions);
      if (portfolioRisk.portfolio_var_95 > this.MAX_PORTFOLIO_RISK * portfolioValue) {
        return { approved: false, reason: `Portfolio VaR limit exceeded: ${(portfolioRisk.portfolio_var_95 / portfolioValue * 100).toFixed(1)}%` };
      }

      // 7. Market conditions check (avoid trading in extreme volatility)
      const marketVolatility = await this.getMarketVolatility(signal.symbol);
      if (marketVolatility > 0.5) { // 50% daily volatility
        return { approved: false, reason: `Extreme volatility: ${(marketVolatility * 100).toFixed(1)}%` };
      }

      return { approved: true };

    } catch (error) {
      logger.error('Risk check failed:', error);
      return { approved: false, reason: 'Risk check system error' };
    }
  }

  private async calculateOptimalPositionSize(signal: any, portfolioValue: number): Promise<{
    quantity: number;
    position_size_pct: number;
    kelly_fraction: number;
    expected_return: number;
    max_loss: number;
    stop_loss: number;
    take_profit: number;
  }> {
    try {
      // Get historical performance for this type of signal
      const historicalPerformance = await this.getSignalPerformanceStats(signal.source);
      
      // Use Kelly Criterion for position sizing
      const winRate = historicalPerformance.win_rate || this.DEFAULT_WIN_RATE;
      const avgWin = historicalPerformance.avg_win || this.DEFAULT_AVG_WIN;
      const avgLoss = historicalPerformance.avg_loss || this.DEFAULT_AVG_LOSS;

      // Kelly Fraction = (b*p - q) / b
      // where b = avg_win/avg_loss, p = win_rate, q = 1-win_rate
      const b = avgWin / avgLoss;
      const p = winRate;
      const q = 1 - winRate;
      const rawKellyFraction = (b * p - q) / b;

      // Apply confidence and risk adjustments
      const confidenceAdjustment = signal.confidence;
      const riskAdjustment = 1 - signal.risk_score;
      
      let kellyFraction = rawKellyFraction * confidenceAdjustment * riskAdjustment;

      // Cap Kelly fraction for risk management
      kellyFraction = Math.max(0, Math.min(kellyFraction, 0.25)); // Never more than 25%

      // Calculate position size percentage
      let positionSizePct = kellyFraction * signal.strength;

      // Apply maximum position size limit
      positionSizePct = Math.min(positionSizePct, this.MAX_POSITION_SIZE);

      // Check existing position
      const existingPosition = await this.getExistingPosition(signal.symbol);
      if (existingPosition) {
        const currentAllocation = existingPosition.market_value / portfolioValue;
        const maxAdditionalAllocation = this.MAX_POSITION_SIZE - currentAllocation;
        positionSizePct = Math.min(positionSizePct, maxAdditionalAllocation);
      }

      // Calculate dollar amount and shares
      const positionValue = portfolioValue * positionSizePct;
      const targetPrice = signal.target_price || signal.price || 100;
      const quantity = Math.floor(positionValue / targetPrice);

      // Calculate risk metrics
      const stopLossDistance = targetPrice * 0.02; // 2% stop loss
      const takeProfitDistance = targetPrice * 0.05; // 5% take profit
      
      const stopLoss = signal.signal_type === 'BUY' 
        ? targetPrice - stopLossDistance
        : targetPrice + stopLossDistance;
        
      const takeProfit = signal.signal_type === 'BUY'
        ? targetPrice + takeProfitDistance
        : targetPrice - takeProfitDistance;

      const expectedReturn = positionValue * (avgWin * winRate - avgLoss * (1 - winRate));
      const maxLoss = quantity * stopLossDistance;

      logger.debug(`📊 Position sizing for ${signal.symbol}:`, {
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

    } catch (error) {
      logger.error('Position sizing calculation failed:', error);
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

  private async calculateExecutionPrice(signal: any): Promise<{
    target: number;
    executed: number;
    slippage: number;
  }> {
    const targetPrice = signal.target_price || signal.price || 100;
    
    // Simulate realistic slippage based on order size and market conditions
    const volatility = await this.getMarketVolatility(signal.symbol);
    const baseSlippageBps = 2; // 2 basis points base slippage
    const volatilitySlippageBps = volatility * 100; // Additional slippage based on volatility
    
    const totalSlippageBps = baseSlippageBps + volatilitySlippageBps;
    const slippageAmount = targetPrice * (totalSlippageBps / 10000);
    
    // Apply slippage direction based on trade side
    const executedPrice = signal.signal_type === 'BUY'
      ? targetPrice + slippageAmount
      : targetPrice - slippageAmount;

    return {
      target: targetPrice,
      executed: parseFloat(executedPrice.toFixed(4)),
      slippage: parseFloat(slippageAmount.toFixed(4))
    };
  }

  private async executeTrade(trade: Trade): Promise<void> {
    try {
      // Store trade in database
      await this.storeTrade(trade);

      // Log execution details
      logger.info(`📋 Trade details stored:`, {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side,
        quantity: trade.quantity,
        executed_price: trade.executed_price,
        commission: trade.commission,
        slippage: trade.slippage
      });

    } catch (error) {
      logger.error('Failed to execute trade:', error);
      throw error;
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

  private async updatePortfolioPositions(trade: Trade): Promise<void> {
    try {
      // Get or create position
      const existingPosition = await this.getExistingPosition(trade.symbol);
      
      if (existingPosition) {
        // Update existing position
        await this.updatePosition(trade, existingPosition);
      } else {
        // Create new position
        await this.createNewPosition(trade);
      }

      logger.debug(`📊 Position updated for ${trade.symbol}`);

    } catch (error) {
      logger.error('Failed to update portfolio positions:', error);
      throw error;
    }
  }

  private async updatePosition(trade: Trade, existingPosition: Position): Promise<void> {
    let newQuantity = existingPosition.quantity;
    let newAvgPrice = existingPosition.avg_price;

    if (trade.side === 'BUY') {
      // Adding to position
      const totalCost = (existingPosition.quantity * existingPosition.avg_price) + 
                       (trade.quantity * trade.executed_price);
      newQuantity += trade.quantity;
      newAvgPrice = totalCost / newQuantity;
    } else {
      // Reducing position
      newQuantity -= trade.quantity;
      // Keep average price the same for sells
    }

    const query = `
      UPDATE positions 
      SET quantity = $1, avg_price = $2, last_update = NOW()
      WHERE symbol = $3
    `;

    await DatabaseManager.query(query, [newQuantity, newAvgPrice, trade.symbol]);
  }

  private async createNewPosition(trade: Trade): Promise<void> {
    if (trade.side === 'SELL') {
      logger.warn(`Cannot create new position with SELL trade for ${trade.symbol}`);
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

    await DatabaseManager.query(query, [
      trade.symbol,
      trade.quantity,
      trade.executed_price,
      trade.executed_price, // Current price same as executed price initially
      marketValue,
      0, // No P&L initially
      0, // No P&L% initially
      trade.timestamp
    ]);
  }

  // Helper methods
  private async getCurrentPositions(): Promise<Position[]> {
    try {
      const query = `SELECT * FROM positions WHERE quantity != 0`;
      const result = await DatabaseManager.query(query);
      
      return result.rows.map((row: any) => ({
        symbol: row.symbol,
        quantity: parseInt(row.quantity),
        avg_price: parseFloat(row.avg_price),
        current_price: parseFloat(row.current_price),
        market_value: parseFloat(row.market_value),
        unrealized_pnl: parseFloat(row.unrealized_pnl),
        unrealized_pnl_pct: parseFloat(row.unrealized_pnl_pct),
        allocation_pct: 0, // Calculate separately
        risk_contribution: 0, // Calculate separately
        days_held: 0 // Calculate separately
      }));
    } catch (error) {
      logger.error('Failed to get current positions:', error);
      return [];
    }
  }

  private async getExistingPosition(symbol: string): Promise<Position | null> {
    try {
      const query = `SELECT * FROM positions WHERE symbol = $1`;
      const result = await DatabaseManager.query(query, [symbol]);
      
      if (result.rows.length === 0) return null;
      
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
    } catch (error) {
      logger.error('Failed to get existing position:', error);
      return null;
    }
  }

  private async getCashRatio(): Promise<number> {
    try {
      const portfolio = await portfolioManager.getLatestPortfolioSnapshot();
      if (!portfolio) return 1.0;
      
      return portfolio.cash / portfolio.total_value;
    } catch (error) {
      logger.error('Failed to get cash ratio:', error);
      return 0.5; // Conservative fallback
    }
  }

  private async calculateSectorExposure(symbol: string, positions: Position[]): Promise<number> {
    // Simplified sector mapping (in production, use proper sector classification)
    const sectors: { [key: string]: string[] } = {
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

    if (targetSector === 'OTHER') return 0;

    // Calculate current exposure to this sector
    const sectorSymbols = sectors[targetSector];
    const sectorPositions = positions.filter(p => sectorSymbols.includes(p.symbol));
    const totalSectorValue = sectorPositions.reduce((sum, p) => sum + p.market_value, 0);
    const totalPortfolioValue = positions.reduce((sum, p) => sum + p.market_value, 0);

    return totalSectorValue / totalPortfolioValue;
  }

  private async calculatePortfolioVaR(positions: Position[]): Promise<RiskMetrics> {
    // Simplified VaR calculation (in production, use Monte Carlo or historical simulation)
    const totalValue = positions.reduce((sum, p) => sum + p.market_value, 0);
    const avgVolatility = 0.02; // 2% daily volatility assumption
    
    return {
      portfolio_var_95: totalValue * avgVolatility * 1.65, // 95% confidence
      portfolio_var_99: totalValue * avgVolatility * 2.33, // 99% confidence
      max_drawdown: totalValue * 0.1, // 10% max drawdown assumption
      sharpe_ratio: 1.0, // Placeholder
      concentration_risk: 0.5, // Placeholder
      leverage: 1.0, // No leverage
      beta: 1.0 // Market beta
    };
  }

  private async getMarketVolatility(symbol: string): Promise<number> {
    try {
      // Get recent price data and calculate volatility
      const query = `
        SELECT close FROM market_data 
        WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '20 days'
        ORDER BY timestamp ASC
      `;
      
      const result = await DatabaseManager.query(query, [symbol]);
      
      if (result.rows.length < 10) return 0.02; // Default 2% volatility
      
      const prices = result.rows.map((row: any) => parseFloat(row.close));
      const returns = [];
      
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1]);
      }
      
      // Calculate standard deviation of returns
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      
      return Math.sqrt(variance);
      
    } catch (error) {
      logger.error('Failed to calculate market volatility:', error);
      return 0.02; // Default volatility
    }
  }

  private async getSignalPerformanceStats(source: string): Promise<{
    win_rate: number;
    avg_win: number;
    avg_loss: number;
  }> {
    try {
      // This would typically analyze historical signal performance
      // For now, return reasonable defaults
      const sourceStats: { [key: string]: any } = {
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
    } catch (error) {
      logger.error('Failed to get signal performance stats:', error);
      return {
        win_rate: this.DEFAULT_WIN_RATE,
        avg_win: this.DEFAULT_AVG_WIN,
        avg_loss: this.DEFAULT_AVG_LOSS
      };
    }
  }

  private updateDailyTradeCount(): void {
    const today = new Date().toDateString();
    const lastTradeDay = this.lastTradeDate.toDateString();
    
    if (today !== lastTradeDay) {
      this.dailyTradeCount = 0;
      this.lastTradeDate = new Date();
    }
    
    this.dailyTradeCount++;
  }
}

export const executionEngine = new ExecutionEngine();
