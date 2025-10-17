/**
 * AI Decision Engine - Advanced reasoning for autonomous trading
 */
import { logger } from '../../utils/logger';
import { DatabaseManager } from '../../utils/database';
import { EventEmitter } from 'events';

export interface MarketFeatures {
  symbol: string;
  asset_type: 'crypto' | 'equity';
  price: number;
  volume: number;
  rsi: number;
  macd: number;
  bollinger_position: number;
  volume_sma_ratio: number;
  price_change_1h: number;
  price_change_24h: number;
  volatility: number;
  market_cap?: number;
}

export interface AISignal {
  symbol: string;
  asset_type: 'crypto' | 'equity';
  signal_type: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  features: MarketFeatures;
  price_at_signal: number;
  target_price?: number;
  stop_loss?: number;
}

export class AIDecisionEngine extends EventEmitter {
  private isRunning = false;
  private analysisInterval = 30000; // 30 seconds for crypto, 5 minutes for equity

  constructor() {
    super();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('🧠 AI Decision Engine started');
    
    // Start continuous analysis
    this.runContinuousAnalysis();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('🧠 AI Decision Engine stopped');
  }

  private async runContinuousAnalysis(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.analyzeAllAssets();
        await this.sleep(this.analysisInterval);
      } catch (error) {
        logger.error('Error in continuous analysis:', error);
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  private async analyzeAllAssets(): Promise<void> {
    try {
      // Get all active assets
      const assetsQuery = `
        SELECT symbol, asset_type, price, volume, last_updated
        FROM assets_live
        WHERE last_updated > NOW() - INTERVAL '5 minutes'
        ORDER BY asset_type, symbol
      `;
      
      const assetsResult = await DatabaseManager.query(assetsQuery);
      
      for (const asset of assetsResult.rows) {
        try {
          const features = await this.calculateFeatures(asset.symbol, asset.asset_type);
          if (features) {
            const signal = await this.generateSignal(features);
            if (signal && signal.signal_type !== 'HOLD') {
              await this.storeSignal(signal);
              this.emit('signal', signal);
              logger.info(`🎯 Signal generated: ${signal.signal_type} ${signal.symbol} (${signal.confidence.toFixed(2)})`);
            }
          }
        } catch (error) {
          logger.error(`Error analyzing ${asset.symbol}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in analyzeAllAssets:', error);
    }
  }

  private async calculateFeatures(symbol: string, assetType: 'crypto' | 'equity'): Promise<MarketFeatures | null> {
    try {
      // Get recent price data
      const priceQuery = `
        SELECT close, volume, timestamp
        FROM price_feeds
        WHERE symbol = $1 AND asset_type = $2
        ORDER BY timestamp DESC
        LIMIT 100
      `;
      
      const priceResult = await DatabaseManager.query(priceQuery, [symbol, assetType]);
      
      if (priceResult.rows.length < 20) {
        return null; // Not enough data
      }
      
      const prices = priceResult.rows.map(row => parseFloat(row.close));
      const volumes = priceResult.rows.map(row => parseFloat(row.volume || 0));
      const currentPrice = prices[0];
      const currentVolume = volumes[0];
      
      // Calculate technical indicators
      const rsi = this.calculateRSI(prices, 14);
      const macd = this.calculateMACD(prices);
      const bollingerPosition = this.calculateBollingerPosition(prices, 20);
      const volumeSMAR = this.calculateVolumeSMAR(volumes, 20);
      const priceChange1h = this.calculatePriceChange(prices, 1);
      const priceChange24h = this.calculatePriceChange(prices, 24);
      const volatility = this.calculateVolatility(prices, 20);
      
      return {
        symbol,
        asset_type: assetType,
        price: currentPrice,
        volume: currentVolume,
        rsi,
        macd,
        bollinger_position: bollingerPosition,
        volume_sma_ratio: volumeSMAR,
        price_change_1h: priceChange1h,
        price_change_24h: priceChange24h,
        volatility
      };
      
    } catch (error) {
      logger.error(`Error calculating features for ${symbol}:`, error);
      return null;
    }
  }

  private async generateSignal(features: MarketFeatures): Promise<AISignal | null> {
    try {
      // Advanced AI reasoning logic
      let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      let confidence = 0;
      let reasoning = '';
      
      // Multi-factor analysis
      const signals = [];
      
      // RSI Analysis
      if (features.rsi < 30) {
        signals.push({ type: 'BUY', weight: 0.3, reason: 'RSI oversold' });
      } else if (features.rsi > 70) {
        signals.push({ type: 'SELL', weight: 0.3, reason: 'RSI overbought' });
      }
      
      // MACD Analysis
      if (features.macd > 0) {
        signals.push({ type: 'BUY', weight: 0.25, reason: 'MACD bullish crossover' });
      } else if (features.macd < -0.1) {
        signals.push({ type: 'SELL', weight: 0.25, reason: 'MACD bearish crossover' });
      }
      
      // Bollinger Bands Analysis
      if (features.bollinger_position < 0.2) {
        signals.push({ type: 'BUY', weight: 0.2, reason: 'Price near lower Bollinger band' });
      } else if (features.bollinger_position > 0.8) {
        signals.push({ type: 'SELL', weight: 0.2, reason: 'Price near upper Bollinger band' });
      }
      
      // Volume Analysis
      if (features.volume_sma_ratio > 1.5) {
        signals.push({ type: 'BUY', weight: 0.15, reason: 'High volume confirmation' });
      }
      
      // Momentum Analysis
      if (features.price_change_24h > 5 && features.price_change_1h > 0) {
        signals.push({ type: 'BUY', weight: 0.1, reason: 'Strong upward momentum' });
      } else if (features.price_change_24h < -5 && features.price_change_1h < 0) {
        signals.push({ type: 'SELL', weight: 0.1, reason: 'Strong downward momentum' });
      }
      
      // Aggregate signals
      const buyWeight = signals.filter(s => s.type === 'BUY').reduce((sum, s) => sum + s.weight, 0);
      const sellWeight = signals.filter(s => s.type === 'SELL').reduce((sum, s) => sum + s.weight, 0);
      
      if (buyWeight > sellWeight && buyWeight > 0.4) {
        signalType = 'BUY';
        confidence = Math.min(buyWeight, 0.95);
        reasoning = signals.filter(s => s.type === 'BUY').map(s => s.reason).join('; ');
      } else if (sellWeight > buyWeight && sellWeight > 0.4) {
        signalType = 'SELL';
        confidence = Math.min(sellWeight, 0.95);
        reasoning = signals.filter(s => s.type === 'SELL').map(s => s.reason).join('; ');
      }
      
      // Risk-adjusted confidence for crypto vs equity
      if (features.asset_type === 'crypto') {
        confidence *= 0.9; // Slightly lower confidence for crypto due to volatility
      }
      
      // Minimum confidence threshold
      if (confidence < 0.5) {
        signalType = 'HOLD';
        reasoning = 'Insufficient confidence for trade signal';
      }
      // Add this at the end of generateSignal method, before return:
      logger.info(`🎯 Signal generated for ${features.symbol}: ${signalType} (confidence: ${confidence.toFixed(2)}) - ${reasoning}`);

      if (signalType !== 'HOLD') {
      logger.info(`📊 Signal details: RSI=${features.rsi.toFixed(1)}, MACD=${features.macd.toFixed(3)}, Price=${features.price.toFixed(2)}`);
      }

      
      return {
        symbol: features.symbol,
        asset_type: features.asset_type,
        signal_type: signalType,
        confidence,
        reasoning,
        features,
        price_at_signal: features.price,
        target_price: this.calculateTargetPrice(features, signalType),
        stop_loss: this.calculateStopLoss(features, signalType)
      };
      
    } catch (error) {
      logger.error('Error generating signal:', error);
      return null;
    }
  }

  private calculateTargetPrice(features: MarketFeatures, signalType: 'BUY' | 'SELL' | 'HOLD'): number | undefined {
    if (signalType === 'HOLD') return undefined;
    
    const volatilityMultiplier = features.asset_type === 'crypto' ? 1.5 : 1.0;
    const targetMove = features.volatility * volatilityMultiplier * 0.02; // 2% of volatility
    
    if (signalType === 'BUY') {
      return features.price * (1 + targetMove);
    } else {
      return features.price * (1 - targetMove);
    }
  }

  private calculateStopLoss(features: MarketFeatures, signalType: 'BUY' | 'SELL' | 'HOLD'): number | undefined {
    if (signalType === 'HOLD') return undefined;
    
    const riskPercentage = features.asset_type === 'crypto' ? 0.05 : 0.03; // 5% for crypto, 3% for equity
    
    if (signalType === 'BUY') {
      return features.price * (1 - riskPercentage);
    } else {
      return features.price * (1 + riskPercentage);
    }
  }

  private async storeSignal(signal: AISignal): Promise<void> {
    try {
      const query = `
        INSERT INTO ai_signals (
          symbol, asset_type, signal_type, confidence, reasoning, 
          features, price_at_signal, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `;
      
      const result = await DatabaseManager.query(query, [
        signal.symbol,
        signal.asset_type,
        signal.signal_type,
        signal.confidence,
        signal.reasoning,
        JSON.stringify(signal.features),
        signal.price_at_signal
      ]);
      
      // Store system event
      await DatabaseManager.query(
        `INSERT INTO system_events (event_type, event_data) VALUES ('AI_SIGNAL', $1)`,
        [JSON.stringify({
          signal_id: result.rows[0].id,
          symbol: signal.symbol,
          signal_type: signal.signal_type,
          confidence: signal.confidence
        })]
      );
      
    } catch (error) {
      logger.error('Failed to store signal:', error);
      throw error;
    }
  }

  // Technical indicator calculations
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i - 1] - prices[i];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): number {
    if (prices.length < 26) return 0;
    
    const ema12 = this.calculateEMA(prices.slice(0, 12), 12);
    const ema26 = this.calculateEMA(prices.slice(0, 26), 26);
    
    return ema12 - ema26;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[prices.length - 1];
    
    for (let i = prices.length - 2; i >= 0; i--) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateBollingerPosition(prices: number[], period: number = 20): number {
    if (prices.length < period) return 0.5;
    
    const recentPrices = prices.slice(0, period);
    const sma = recentPrices.reduce((sum, p) => sum + p, 0) / period;
    const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const upperBand = sma + (2 * stdDev);
    const lowerBand = sma - (2 * stdDev);
    
    const currentPrice = prices[0];
    return (currentPrice - lowerBand) / (upperBand - lowerBand);
  }

  private calculateVolumeSMAR(volumes: number[], period: number = 20): number {
    if (volumes.length < period) return 1;
    
    const currentVolume = volumes[0];
    const avgVolume = volumes.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
    
    return avgVolume > 0 ? currentVolume / avgVolume : 1;
  }

  private calculatePriceChange(prices: number[], periods: number): number {
    if (prices.length <= periods) return 0;
    
    const currentPrice = prices[0];
    const pastPrice = prices[periods];
    
    return ((currentPrice - pastPrice) / pastPrice) * 100;
  }

  private calculateVolatility(prices: number[], period: number = 20): number {
    if (prices.length < period) return 0;
    
    const recentPrices = prices.slice(0, period);
    const returns = [];
    
    for (let i = 1; i < recentPrices.length; i++) {
      returns.push((recentPrices[i - 1] - recentPrices[i]) / recentPrices[i]);
    }
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * 100;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const aiDecisionEngine = new AIDecisionEngine();
