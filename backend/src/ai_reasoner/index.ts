/**
 * Elysian Trading System - AI Reasoner
 * Hugging Face-powered market analysis and reasoning
 */

import { HfInference } from '@huggingface/inference';
import { logger } from '@/utils/logger';
import { DatabaseManager } from '@/utils/database';
import { TradingSignal } from '@/signal_engine';
import { FeatureSet } from '@/features';
import { MarketData } from '@/data_ingestor';

export interface AIAnalysis {
  symbol: string;
  timestamp: Date;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  reasoning: string[];
  key_factors: string[];
  risk_assessment: {
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    factors: string[];
    score: number; // 0-1
  };
  recommendation: {
    action: 'BUY' | 'SELL' | 'HOLD';
    strength: number; // 0-1
    position_size_pct: number; // 0-100
    time_horizon: 'SHORT' | 'MEDIUM' | 'LONG';
  };
  market_context: {
    volatility_regime: 'LOW' | 'MEDIUM' | 'HIGH';
    trend_direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    market_phase: 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN';
  };
  metadata: {
    model_used: string;
    processing_time_ms: number;
    data_quality: number;
    analysis_depth: number;
  };
}

export class AIReasoner {
  private hf: HfInference;
  private model: string = 'microsoft/DialoGPT-large';

  constructor() {
    const apiKey = process.env.HF_API_KEY;
    if (!apiKey) {
      logger.warn('HF_API_KEY not provided - AI analysis will be limited');
    }
    this.hf = new HfInference(apiKey);
  }

  async analyzeMarket(
    symbol: string,
    marketData: MarketData[],
    features: FeatureSet,
    signals: TradingSignal[]
  ): Promise<AIAnalysis> {
    const startTime = Date.now();

    try {
      // Create market context for AI analysis
      const context = this.buildMarketContext(symbol, marketData, features, signals);

      // Generate AI insights
      const aiInsights = await this.generateAIInsights(context);

      // Combine with quantitative analysis
      const analysis = this.synthesizeAnalysis(symbol, features, signals, aiInsights);

      analysis.metadata.processing_time_ms = Date.now() - startTime;

      // Store analysis in database
      await this.storeAnalysis(analysis);

      logger.info(`AI analysis completed for ${symbol}`, {
        sentiment: analysis.sentiment,
        confidence: analysis.confidence,
        processing_time: analysis.metadata.processing_time_ms
      });

      return analysis;

    } catch (error) {
      logger.error(`AI analysis failed for ${symbol}:`, error);
      // Return fallback analysis
      return this.createFallbackAnalysis(symbol, features, signals, Date.now() - startTime);
    }
  }

  private buildMarketContext(
    symbol: string,
    marketData: MarketData[],
    features: FeatureSet,
    signals: TradingSignal[]
  ): string {
    const latest = marketData[marketData.length - 1];
    const f = features.features;

    // Calculate price performance
    const weekAgo = marketData[Math.max(0, marketData.length - 7)];
    const weeklyChange = weekAgo ? ((latest.close - weekAgo.close) / weekAgo.close * 100) : 0;

    // Signal consensus
    const buySignals = signals.filter(s => s.signal_type === 'BUY');
    const sellSignals = signals.filter(s => s.signal_type === 'SELL');

    const context = `
Market Analysis for ${symbol}:

Current Price: $${latest.close.toFixed(2)}
Weekly Performance: ${weeklyChange > 0 ? '+' : ''}${weeklyChange.toFixed(2)}%
Volume: ${latest.volume.toLocaleString()} (${f.volume_ratio.toFixed(2)}x average)
Volatility: ${f.volatility_20.toFixed(1)}% (20-day annualized)

Technical Indicators:
- RSI(14): ${f.rsi_14.toFixed(1)} ${f.rsi_overbought ? '(Overbought)' : f.rsi_oversold ? '(Oversold)' : '(Neutral)'}
- MACD: ${f.macd_bullish ? 'Bullish' : 'Bearish'} (${f.macd_line.toFixed(3)})
- Bollinger Bands: ${f.bb_percent_b.toFixed(2)} (0=lower band, 1=upper band)
- Trend: Short-term ${f.trend_short}, Long-term ${f.trend_long}

Moving Averages:
- SMA5: $${f.sma_5.toFixed(2)}, SMA20: $${f.sma_20.toFixed(2)}, SMA50: $${f.sma_50.toFixed(2)}
- EMA12: $${f.ema_12.toFixed(2)}, EMA26: $${f.ema_26.toFixed(2)}

Support/Resistance:
- Support: $${f.support_level.toFixed(2)}
- Resistance: $${f.resistance_level.toFixed(2)}

Pattern Recognition:
- Hammer: ${f.hammer ? 'Yes' : 'No'}
- Doji: ${f.doji ? 'Yes' : 'No'}
- Bullish Engulfing: ${f.engulfing_bullish ? 'Yes' : 'No'}
- Bearish Engulfing: ${f.engulfing_bearish ? 'Yes' : 'No'}

Trading Signals:
- Buy Signals: ${buySignals.length} (avg strength: ${buySignals.length > 0 ? (buySignals.reduce((s, sig) => s + sig.strength, 0) / buySignals.length).toFixed(2) : 'N/A'})
- Sell Signals: ${sellSignals.length} (avg strength: ${sellSignals.length > 0 ? (sellSignals.reduce((s, sig) => s + sig.strength, 0) / sellSignals.length).toFixed(2) : 'N/A'})

Signal Sources: ${signals.map(s => s.source).join(', ')}
`;

    return context;
  }

  private async generateAIInsights(context: string): Promise<any> {
    try {
      if (!process.env.HF_API_KEY) {
        return { fallback: true };
      }

      // Create a prompt for market analysis
      const prompt = `
You are an expert financial analyst. Analyze the following market data and provide insights:

${context}

Please provide:
1. Overall market sentiment (Bullish/Bearish/Neutral)
2. Key factors driving the analysis
3. Risk assessment
4. Trading recommendation with rationale

Analysis:`;

      const response = await this.hf.textGeneration({
        model: this.model,
        inputs: prompt,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.3,
          return_full_text: false
        }
      });

      return {
        generated_text: response.generated_text || 'Analysis generated',
        fallback: false
      };

    } catch (error) {
      logger.warn('HuggingFace API call failed, using fallback:', error);
      return { fallback: true };
    }
  }

  private synthesizeAnalysis(
    symbol: string,
    features: FeatureSet,
    signals: TradingSignal[],
    aiInsights: any
  ): AIAnalysis {
    const f = features.features;

    // Determine sentiment based on signals and features
    const buySignals = signals.filter(s => s.signal_type === 'BUY');
    const sellSignals = signals.filter(s => s.signal_type === 'SELL');

    let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0.5;

    if (buySignals.length > sellSignals.length && buySignals.length > 0) {
      sentiment = 'BULLISH';
      confidence = Math.min(0.9, buySignals.reduce((sum, s) => sum + s.confidence, 0) / buySignals.length);
    } else if (sellSignals.length > buySignals.length && sellSignals.length > 0) {
      sentiment = 'BEARISH';
      confidence = Math.min(0.9, sellSignals.reduce((sum, s) => sum + s.confidence, 0) / sellSignals.length);
    }

    // Generate reasoning
    const reasoning: string[] = [];
    if (!aiInsights.fallback && aiInsights.generated_text) {
      reasoning.push(`AI Analysis: ${aiInsights.generated_text.substring(0, 200)}...`);
    }

    if (f.trend_short === f.trend_long) {
      reasoning.push(`Strong ${f.trend_short} trend alignment across timeframes`);
    }

    if (f.macd_bullish && f.rsi_14 < 70) {
      reasoning.push('MACD bullish with RSI not overbought - positive momentum');
    } else if (!f.macd_bullish && f.rsi_14 > 30) {
      reasoning.push('MACD bearish with RSI not oversold - negative momentum');
    }

    if (f.volume_ratio > 1.5) {
      reasoning.push(`High volume confirmation (${f.volume_ratio.toFixed(1)}x average)`);
    }

    // Key factors
    const key_factors: string[] = [];
    if (f.volatility_20 > 25) key_factors.push('High volatility environment');
    if (f.bb_squeeze) key_factors.push('Bollinger Bands squeeze - potential breakout');
    if (Math.abs(f.price - f.support_level) / f.price < 0.02) key_factors.push('Near support level');
    if (Math.abs(f.price - f.resistance_level) / f.price < 0.02) key_factors.push('Near resistance level');

    // Risk assessment
    const volatility_risk = f.volatility_20 > 30 ? 0.8 : f.volatility_20 > 15 ? 0.5 : 0.3;
    const signal_risk = signals.length > 0 ? Math.max(...signals.map(s => s.risk_score)) : 0.5;
    const overall_risk = (volatility_risk + signal_risk) / 2;

    const risk_level = overall_risk > 0.7 ? 'HIGH' : overall_risk > 0.4 ? 'MEDIUM' : 'LOW';
    const risk_factors: string[] = [];
    if (volatility_risk > 0.6) risk_factors.push('High price volatility');
    if (f.volume_ratio < 0.5) risk_factors.push('Low volume - poor liquidity');
    if (buySignals.length > 0 && sellSignals.length > 0) risk_factors.push('Conflicting signals');

    // Recommendation
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 0.3;
    let position_size_pct = 5; // Conservative default

    if (sentiment === 'BULLISH' && confidence > 0.6) {
      action = 'BUY';
      strength = confidence;
      position_size_pct = Math.min(25, 5 + (confidence - 0.6) * 50);
    } else if (sentiment === 'BEARISH' && confidence > 0.6) {
      action = 'SELL';
      strength = confidence;
      position_size_pct = Math.min(25, 5 + (confidence - 0.6) * 50);
    }

    // Adjust for risk
    if (risk_level === 'HIGH') {
      position_size_pct *= 0.5;
    } else if (risk_level === 'LOW') {
      position_size_pct *= 1.2;
    }

    // Market context
    const volatility_regime = f.volatility_20 > 25 ? 'HIGH' : f.volatility_20 > 12 ? 'MEDIUM' : 'LOW';
    const trend_direction = f.trend_long === 'up' ? 'UP' : f.trend_long === 'down' ? 'DOWN' : 'SIDEWAYS';

    let market_phase: 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN' = 'ACCUMULATION';
    if (f.trend_long === 'up' && f.volume_ratio > 1.2) market_phase = 'MARKUP';
    else if (f.trend_long === 'down' && f.volume_ratio > 1.2) market_phase = 'MARKDOWN';
    else if (volatility_regime === 'LOW') market_phase = 'ACCUMULATION';
    else market_phase = 'DISTRIBUTION';

    return {
      symbol,
      timestamp: features.timestamp,
      sentiment,
      confidence,
      reasoning,
      key_factors,
      risk_assessment: {
        level: risk_level,
        factors: risk_factors,
        score: overall_risk
      },
      recommendation: {
        action,
        strength,
        position_size_pct: Math.max(1, Math.min(50, position_size_pct)),
        time_horizon: f.volatility_20 > 20 ? 'SHORT' : 'MEDIUM'
      },
      market_context: {
        volatility_regime,
        trend_direction,
        market_phase
      },
      metadata: {
        model_used: aiInsights.fallback ? 'quantitative_fallback' : this.model,
        processing_time_ms: 0, // Set by caller
        data_quality: features.metadata.data_quality_score,
        analysis_depth: aiInsights.fallback ? 0.6 : 0.9
      }
    };
  }

  private createFallbackAnalysis(
    symbol: string,
    features: FeatureSet,
    signals: TradingSignal[],
    processingTime: number
  ): AIAnalysis {
    return {
      symbol,
      timestamp: features.timestamp,
      sentiment: 'NEUTRAL',
      confidence: 0.4,
      reasoning: ['Fallback analysis due to AI service unavailability'],
      key_factors: ['Technical indicators analysis only'],
      risk_assessment: {
        level: 'MEDIUM',
        factors: ['Limited analysis depth'],
        score: 0.5
      },
      recommendation: {
        action: 'HOLD',
        strength: 0.3,
        position_size_pct: 5,
        time_horizon: 'MEDIUM'
      },
      market_context: {
        volatility_regime: features.features.volatility_20 > 20 ? 'HIGH' : 'LOW',
        trend_direction: 'SIDEWAYS',
        market_phase: 'ACCUMULATION'
      },
      metadata: {
        model_used: 'fallback',
        processing_time_ms: processingTime,
        data_quality: features.metadata.data_quality_score,
        analysis_depth: 0.3
      }
    };
  }

  private async storeAnalysis(analysis: AIAnalysis): Promise<void> {
    try {
      const query = `
        INSERT INTO ai_analysis (
          symbol, timestamp, sentiment, confidence, reasoning, key_factors,
          risk_assessment, recommendation, market_context, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (symbol, timestamp) DO UPDATE SET
          sentiment = EXCLUDED.sentiment,
          confidence = EXCLUDED.confidence,
          reasoning = EXCLUDED.reasoning,
          key_factors = EXCLUDED.key_factors,
          risk_assessment = EXCLUDED.risk_assessment,
          recommendation = EXCLUDED.recommendation,
          market_context = EXCLUDED.market_context,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `;

      await DatabaseManager.query(query, [
        analysis.symbol,
        analysis.timestamp,
        analysis.sentiment,
        analysis.confidence,
        JSON.stringify(analysis.reasoning),
        JSON.stringify(analysis.key_factors),
        JSON.stringify(analysis.risk_assessment),
        JSON.stringify(analysis.recommendation),
        JSON.stringify(analysis.market_context),
        JSON.stringify(analysis.metadata)
      ]);

    } catch (error) {
      logger.error('Failed to store AI analysis:', error);
      throw error;
    }
  }

  async getLatestAnalysis(symbols: string[]): Promise<AIAnalysis[]> {
    try {
      const query = `
        SELECT *
        FROM ai_analysis
        WHERE symbol = ANY($1)
        ORDER BY timestamp DESC
        LIMIT ${symbols.length}
      `;

      const result = await DatabaseManager.query(query, [symbols]);

      return result.rows.map((row: any) => ({
        symbol: row.symbol,
        timestamp: new Date(row.timestamp),
        sentiment: row.sentiment,
        confidence: parseFloat(row.confidence),
        reasoning: JSON.parse(row.reasoning || '[]'),
        key_factors: JSON.parse(row.key_factors || '[]'),
        risk_assessment: JSON.parse(row.risk_assessment || '{}'),
        recommendation: JSON.parse(row.recommendation || '{}'),
        market_context: JSON.parse(row.market_context || '{}'),
        metadata: JSON.parse(row.metadata || '{}')
      }));

    } catch (error) {
      logger.error('Failed to get latest AI analysis:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!process.env.HF_API_KEY) {
        return false;
      }

      // Simple test call
      const response = await this.hf.textGeneration({
        model: this.model,
        inputs: 'Test',
        parameters: { max_new_tokens: 1 }
      });

      return !!response;
    } catch (error) {
      logger.error('AI Reasoner health check failed:', error);
      return false;
    }
  }
}

export const aiReasoner = new AIReasoner();
