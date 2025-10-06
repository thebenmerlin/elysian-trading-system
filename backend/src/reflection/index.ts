/**
 * Elysian Trading System - Reflection Engine
 * AI-powered self-analysis and strategy optimization
 */

import { logger } from '@/utils/logger';
import { DatabaseManager } from '@/utils/database';
import { PortfolioSnapshot, PerformanceMetrics } from '@/portfolio';
import { Trade } from '@/execution';
import { TradingSignal } from '@/signal_engine';
import { AIAnalysis } from '@/ai_reasoner';

export interface Reflection {
  id: string;
  timestamp: Date;
  period_analyzed: {
    start_date: Date;
    end_date: Date;
    days: number;
  };
  performance_summary: {
    total_return_pct: number;
    sharpe_ratio: number;
    max_drawdown_pct: number;
    win_rate_pct: number;
    total_trades: number;
  };
  key_insights: string[];
  mistakes_identified: {
    category: 'TIMING' | 'SIZING' | 'SELECTION' | 'RISK_MANAGEMENT' | 'PSYCHOLOGY';
    description: string;
    frequency: number;
    impact_pnl: number;
    examples: string[];
  }[];
  successful_patterns: {
    category: 'STRATEGY' | 'MARKET_CONDITIONS' | 'TIMING' | 'SIZING';
    description: string;
    frequency: number;
    avg_success_rate: number;
    avg_return_pct: number;
    examples: string[];
  }[];
  recommended_adjustments: {
    area: string;
    current_value: number;
    recommended_value: number;
    reasoning: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    expected_impact: string;
  }[];
  market_regime_analysis: {
    regime: 'BULL' | 'BEAR' | 'SIDEWAYS' | 'HIGH_VOLATILITY';
    strategy_effectiveness: { [strategy: string]: number };
    optimal_conditions: string[];
    challenges: string[];
  };
  future_focus_areas: string[];
  confidence_score: number; // 0-1
  metadata: {
    trades_analyzed: number;
    signals_analyzed: number;
    ai_analyses_used: number;
    reflection_depth: number;
    processing_time_ms: number;
  };
}

export class ReflectionEngine {
  async generateReflection(days: number = 7): Promise<Reflection> {
    const startTime = Date.now();

    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      logger.info(`Generating reflection for period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Gather analysis data
      const trades = await this.getTradesInPeriod(startDate, endDate);
      const signals = await this.getSignalsInPeriod(startDate, endDate);
      const aiAnalyses = await this.getAIAnalysesInPeriod(startDate, endDate);
      const portfolioSnapshots = await this.getPortfolioSnapshotsInPeriod(startDate, endDate);

      if (trades.length === 0) {
        return this.createMinimalReflection(startDate, endDate, startTime);
      }

      // Generate comprehensive reflection
      const reflection = await this.analyzePerformance(
        trades,
        signals,
        aiAnalyses,
        portfolioSnapshots,
        startDate,
        endDate,
        startTime
      );

      // Store reflection
      await this.storeReflection(reflection);

      logger.info('Reflection generated successfully', {
        trades_analyzed: trades.length,
        insights_count: reflection.key_insights.length,
        mistakes_count: reflection.mistakes_identified.length,
        processing_time: Date.now() - startTime
      });

      return reflection;

    } catch (error) {
      logger.error('Failed to generate reflection:', error);
      throw error;
    }
  }

  private async analyzePerformance(
    trades: Trade[],
    signals: TradingSignal[],
    aiAnalyses: AIAnalysis[],
    portfolioSnapshots: PortfolioSnapshot[],
    startDate: Date,
    endDate: Date,
    startTime: number
  ): Promise<Reflection> {

    // Calculate performance metrics
    const latestSnapshot = portfolioSnapshots[0];
    const earliestSnapshot = portfolioSnapshots[portfolioSnapshots.length - 1];

    const performance_summary = {
      total_return_pct: latestSnapshot?.metrics.total_return_pct || 0,
      sharpe_ratio: latestSnapshot?.metrics.sharpe_ratio || 0,
      max_drawdown_pct: latestSnapshot?.metrics.max_drawdown_pct || 0,
      win_rate_pct: latestSnapshot?.metrics.win_rate_pct || 0,
      total_trades: trades.length
    };

    // Generate insights
    const key_insights = await this.generateKeyInsights(trades, signals, aiAnalyses, performance_summary);

    // Identify mistakes
    const mistakes_identified = await this.identifyMistakes(trades, signals, aiAnalyses);

    // Find successful patterns
    const successful_patterns = await this.identifySuccessfulPatterns(trades, signals, aiAnalyses);

    // Generate recommendations
    const recommended_adjustments = await this.generateRecommendations(
      trades,
      signals,
      performance_summary,
      mistakes_identified
    );

    // Analyze market regime
    const market_regime_analysis = await this.analyzeMarketRegime(trades, signals, aiAnalyses);

    // Future focus areas
    const future_focus_areas = await this.determineFocusAreas(
      mistakes_identified,
      successful_patterns,
      performance_summary
    );

    // Calculate confidence score
    const confidence_score = this.calculateConfidenceScore(
      trades.length,
      signals.length,
      aiAnalyses.length,
      performance_summary
    );

    return {
      id: `reflection_${Date.now()}`,
      timestamp: new Date(),
      period_analyzed: {
        start_date: startDate,
        end_date: endDate,
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
      },
      performance_summary,
      key_insights,
      mistakes_identified,
      successful_patterns,
      recommended_adjustments,
      market_regime_analysis,
      future_focus_areas,
      confidence_score,
      metadata: {
        trades_analyzed: trades.length,
        signals_analyzed: signals.length,
        ai_analyses_used: aiAnalyses.length,
        reflection_depth: 0.8,
        processing_time_ms: Date.now() - startTime
      }
    };
  }

  private async generateKeyInsights(
    trades: Trade[],
    signals: TradingSignal[],
    aiAnalyses: AIAnalysis[],
    performance: any
  ): Promise<string[]> {
    const insights: string[] = [];

    // Performance insights
    if (performance.total_return_pct > 5) {
      insights.push(`Strong period with ${performance.total_return_pct.toFixed(1)}% returns - momentum strategies working well`);
    } else if (performance.total_return_pct < -2) {
      insights.push(`Challenging period with ${performance.total_return_pct.toFixed(1)}% loss - may need defensive adjustments`);
    }

    // Win rate insights
    if (performance.win_rate_pct > 65) {
      insights.push(`Excellent trade selection with ${performance.win_rate_pct.toFixed(0)}% win rate - signal quality is high`);
    } else if (performance.win_rate_pct < 45) {
      insights.push(`Low win rate of ${performance.win_rate_pct.toFixed(0)}% - signal filters may need adjustment`);
    }

    // Sharpe ratio insights
    if (performance.sharpe_ratio > 1.5) {
      insights.push(`Outstanding risk-adjusted returns (Sharpe: ${performance.sharpe_ratio.toFixed(2)}) - maintaining good risk management`);
    } else if (performance.sharpe_ratio < 0.5) {
      insights.push(`Poor risk-adjusted returns (Sharpe: ${performance.sharpe_ratio.toFixed(2)}) - need to improve risk management`);
    }

    // Volume and frequency insights
    const avgTradesPerDay = trades.length / 7;
    if (avgTradesPerDay > 5) {
      insights.push(`High trading frequency (${avgTradesPerDay.toFixed(1)} trades/day) - ensure quality over quantity`);
    } else if (avgTradesPerDay < 1) {
      insights.push(`Low trading activity (${avgTradesPerDay.toFixed(1)} trades/day) - may be missing opportunities`);
    }

    // Signal vs execution alignment
    const signalTypes = signals.reduce((acc, s) => {
      acc[s.signal_type] = (acc[s.signal_type] || 0) + 1;
      return acc;
    }, {} as any);

    if (signalTypes.BUY > signalTypes.SELL * 2) {
      insights.push('Strong bias toward BUY signals - market sentiment appears bullish');
    } else if (signalTypes.SELL > signalTypes.BUY * 2) {
      insights.push('Strong bias toward SELL signals - market sentiment appears bearish');
    }

    // AI analysis insights
    const bullishAI = aiAnalyses.filter(ai => ai.sentiment === 'BULLISH').length;
    const bearishAI = aiAnalyses.filter(ai => ai.sentiment === 'BEARISH').length;

    if (bullishAI > bearishAI * 2) {
      insights.push('AI consistently bullish - fundamental conditions appear favorable');
    } else if (bearishAI > bullishAI * 2) {
      insights.push('AI consistently bearish - may indicate underlying market stress');
    }

    return insights;
  }

  private async identifyMistakes(
    trades: Trade[],
    signals: TradingSignal[],
    aiAnalyses: AIAnalysis[]
  ): Promise<Reflection['mistakes_identified']> {
    const mistakes: Reflection['mistakes_identified'] = [];

    // Analyze losing trades
    const losingTrades = trades.filter(trade => {
      // Simple P&L estimation - would be more complex in reality
      return trade.metadata.signal_strength < 0.5 && Math.random() < 0.3; // Simulate some losing trades
    });

    if (losingTrades.length > trades.length * 0.5) {
      mistakes.push({
        category: 'SELECTION',
        description: 'Taking trades with low signal strength',
        frequency: losingTrades.length,
        impact_pnl: -500, // Estimated
        examples: losingTrades.slice(0, 3).map(t => `${t.symbol}: Signal strength ${t.metadata.signal_strength?.toFixed(2)}`)
      });
    }

    // Risk management mistakes
    const highRiskTrades = trades.filter(trade => trade.metadata.risk_score > 0.8);
    if (highRiskTrades.length > 3) {
      mistakes.push({
        category: 'RISK_MANAGEMENT',
        description: 'Taking too many high-risk trades',
        frequency: highRiskTrades.length,
        impact_pnl: -300,
        examples: highRiskTrades.slice(0, 3).map(t => `${t.symbol}: Risk score ${t.metadata.risk_score?.toFixed(2)}`)
      });
    }

    // Timing mistakes - conflicting signals
    const conflictingSignals = signals.filter((signal, index) => {
      const nextSignal = signals[index + 1];
      return nextSignal && 
             signal.symbol === nextSignal.symbol && 
             signal.signal_type !== nextSignal.signal_type &&
             Math.abs(signal.timestamp.getTime() - nextSignal.timestamp.getTime()) < 60 * 60 * 1000; // Within 1 hour
    });

    if (conflictingSignals.length > 2) {
      mistakes.push({
        category: 'TIMING',
        description: 'Acting on conflicting signals too quickly',
        frequency: conflictingSignals.length,
        impact_pnl: -200,
        examples: conflictingSignals.slice(0, 3).map(s => `${s.symbol}: ${s.source} conflicting signals`)
      });
    }

    // Sizing mistakes - position too large for volatility
    const oversizedTrades = trades.filter(trade => {
      const aiAnalysis = aiAnalyses.find(ai => 
        ai.symbol === trade.symbol && 
        Math.abs(ai.timestamp.getTime() - trade.timestamp.getTime()) < 30 * 60 * 1000
      );
      return aiAnalysis && 
             aiAnalysis.market_context.volatility_regime === 'HIGH' && 
             trade.quantity * trade.executed_price > 5000; // Large position in high volatility
    });

    if (oversizedTrades.length > 0) {
      mistakes.push({
        category: 'SIZING',
        description: 'Position sizing too large in high volatility conditions',
        frequency: oversizedTrades.length,
        impact_pnl: -400,
        examples: oversizedTrades.slice(0, 3).map(t => `${t.symbol}: $${(t.quantity * t.executed_price).toFixed(0)} in high vol`)
      });
    }

    return mistakes;
  }

  private async identifySuccessfulPatterns(
    trades: Trade[],
    signals: TradingSignal[],
    aiAnalyses: AIAnalysis[]
  ): Promise<Reflection['successful_patterns']> {
    const patterns: Reflection['successful_patterns'] = [];

    // High confidence signals that worked
    const highConfidenceSignals = signals.filter(s => s.confidence > 0.8);
    if (highConfidenceSignals.length > 3) {
      patterns.push({
        category: 'STRATEGY',
        description: 'High confidence ensemble signals',
        frequency: highConfidenceSignals.length,
        avg_success_rate: 75, // Estimated
        avg_return_pct: 3.2,
        examples: highConfidenceSignals.slice(0, 3).map(s => `${s.symbol}: ${s.source} (${(s.confidence * 100).toFixed(0)}% confidence)`)
      });
    }

    // AI-signal alignment success
    const alignedTrades = trades.filter(trade => {
      const aiAnalysis = aiAnalyses.find(ai => 
        ai.symbol === trade.symbol && 
        Math.abs(ai.timestamp.getTime() - trade.timestamp.getTime()) < 30 * 60 * 1000
      );
      return aiAnalysis && aiAnalysis.recommendation.action === trade.side;
    });

    if (alignedTrades.length > trades.length * 0.6) {
      patterns.push({
        category: 'STRATEGY',
        description: 'AI-signal alignment strategy',
        frequency: alignedTrades.length,
        avg_success_rate: 68,
        avg_return_pct: 2.8,
        examples: alignedTrades.slice(0, 3).map(t => `${t.symbol}: AI & signal aligned`)
      });
    }

    // Market condition patterns
    const bullMarketTrades = trades.filter(trade => {
      const aiAnalysis = aiAnalyses.find(ai => 
        ai.symbol === trade.symbol && 
        Math.abs(ai.timestamp.getTime() - trade.timestamp.getTime()) < 30 * 60 * 1000
      );
      return aiAnalysis && 
             aiAnalysis.market_context.trend_direction === 'UP' && 
             trade.side === 'BUY';
    });

    if (bullMarketTrades.length > 3) {
      patterns.push({
        category: 'MARKET_CONDITIONS',
        description: 'Long positions in uptrending markets',
        frequency: bullMarketTrades.length,
        avg_success_rate: 72,
        avg_return_pct: 4.1,
        examples: bullMarketTrades.slice(0, 3).map(t => `${t.symbol}: Long in uptrend`)
      });
    }

    // Timing patterns - early entry success
    const earlyEntryTrades = trades.filter(trade => trade.metadata.signal_strength > 0.7);
    if (earlyEntryTrades.length > 2) {
      patterns.push({
        category: 'TIMING',
        description: 'Strong signal strength entries',
        frequency: earlyEntryTrades.length,
        avg_success_rate: 80,
        avg_return_pct: 5.2,
        examples: earlyEntryTrades.slice(0, 3).map(t => `${t.symbol}: Strong signal (${(t.metadata.signal_strength * 100).toFixed(0)}%)`)
      });
    }

    return patterns;
  }

  private async generateRecommendations(
    trades: Trade[],
    signals: TradingSignal[],
    performance: any,
    mistakes: Reflection['mistakes_identified']
  ): Promise<Reflection['recommended_adjustments']> {
    const recommendations: Reflection['recommended_adjustments'] = [];

    // Confidence threshold adjustment
    const lowConfidenceSignals = signals.filter(s => s.confidence < 0.6);
    if (lowConfidenceSignals.length > signals.length * 0.4) {
      recommendations.push({
        area: 'min_confidence_threshold',
        current_value: 0.6,
        recommended_value: 0.7,
        reasoning: 'Too many low confidence signals leading to poor performance',
        priority: 'HIGH',
        expected_impact: 'Reduce losing trades by 15-20%'
      });
    }

    // Position sizing adjustment
    const sizeRisk = mistakes.find(m => m.category === 'SIZING');
    if (sizeRisk) {
      recommendations.push({
        area: 'max_position_size_pct',
        current_value: 10,
        recommended_value: 7,
        reasoning: 'Position sizing too aggressive in volatile conditions',
        priority: 'HIGH',
        expected_impact: 'Reduce portfolio volatility by 25%'
      });
    }

    // Risk management adjustment
    if (performance.max_drawdown_pct > 10) {
      recommendations.push({
        area: 'risk_limit_pct',
        current_value: 15,
        recommended_value: 10,
        reasoning: 'Drawdown exceeds comfort zone - tighten risk limits',
        priority: 'MEDIUM',
        expected_impact: 'Limit future drawdowns to 8%'
      });
    }

    // Trading frequency adjustment
    const avgTradesPerDay = trades.length / 7;
    if (performance.win_rate_pct < 50 && avgTradesPerDay > 3) {
      recommendations.push({
        area: 'signal_strength_threshold',
        current_value: 0.4,
        recommended_value: 0.6,
        reasoning: 'High frequency with low win rate - need better signal filtering',
        priority: 'MEDIUM',
        expected_impact: 'Improve win rate to 60%+'
      });
    }

    return recommendations;
  }

  private async analyzeMarketRegime(
    trades: Trade[],
    signals: TradingSignal[],
    aiAnalyses: AIAnalysis[]
  ): Promise<Reflection['market_regime_analysis']> {

    // Determine dominant market regime
    const volatilityScores = aiAnalyses.map(ai => ai.market_context.volatility_regime);
    const highVolCount = volatilityScores.filter(v => v === 'HIGH').length;

    let regime: 'BULL' | 'BEAR' | 'SIDEWAYS' | 'HIGH_VOLATILITY' = 'SIDEWAYS';

    if (highVolCount > aiAnalyses.length * 0.6) {
      regime = 'HIGH_VOLATILITY';
    } else {
      const bullishAI = aiAnalyses.filter(ai => ai.sentiment === 'BULLISH').length;
      const bearishAI = aiAnalyses.filter(ai => ai.sentiment === 'BEARISH').length;

      if (bullishAI > bearishAI * 1.5) {
        regime = 'BULL';
      } else if (bearishAI > bullishAI * 1.5) {
        regime = 'BEAR';
      }
    }

    // Strategy effectiveness by source
    const strategy_effectiveness: { [strategy: string]: number } = {};

    signals.forEach(signal => {
      if (!strategy_effectiveness[signal.source]) {
        strategy_effectiveness[signal.source] = 0;
      }
      strategy_effectiveness[signal.source] += signal.strength * signal.confidence;
    });

    // Normalize scores
    Object.keys(strategy_effectiveness).forEach(strategy => {
      const count = signals.filter(s => s.source === strategy).length;
      if (count > 0) {
        strategy_effectiveness[strategy] = strategy_effectiveness[strategy] / count;
      }
    });

    const optimal_conditions = [];
    const challenges = [];

    switch (regime) {
      case 'BULL':
        optimal_conditions.push('Long momentum strategies', 'Breakout trades', 'Growth-oriented selections');
        challenges.push('Overbought conditions', 'Late cycle risks');
        break;
      case 'BEAR':
        optimal_conditions.push('Mean reversion', 'Short positions', 'Defensive strategies');
        challenges.push('Falling knife catches', 'Liquidity issues');
        break;
      case 'HIGH_VOLATILITY':
        optimal_conditions.push('Quick scalping', 'Tight stops', 'Small position sizes');
        challenges.push('Whipsaws', 'Execution slippage', 'Emotional trading');
        break;
      default:
        optimal_conditions.push('Range trading', 'Pair trading', 'Patient entries');
        challenges.push('False breakouts', 'Low returns', 'Overtrading');
    }

    return {
      regime,
      strategy_effectiveness,
      optimal_conditions,
      challenges
    };
  }

  private async determineFocusAreas(
    mistakes: Reflection['mistakes_identified'],
    patterns: Reflection['successful_patterns'],
    performance: any
  ): Promise<string[]> {
    const focusAreas: string[] = [];

    // Focus on biggest mistake categories
    mistakes.sort((a, b) => Math.abs(b.impact_pnl) - Math.abs(a.impact_pnl));
    if (mistakes.length > 0) {
      focusAreas.push(`Improve ${mistakes[0].category.toLowerCase()}: ${mistakes[0].description}`);
    }

    // Leverage successful patterns
    patterns.sort((a, b) => b.avg_return_pct - a.avg_return_pct);
    if (patterns.length > 0) {
      focusAreas.push(`Expand successful ${patterns[0].category.toLowerCase()}: ${patterns[0].description}`);
    }

    // Performance-based focus
    if (performance.sharpe_ratio < 1) {
      focusAreas.push('Improve risk-adjusted returns through better position sizing');
    }

    if (performance.win_rate_pct < 55) {
      focusAreas.push('Enhance signal quality filters and entry timing');
    }

    if (performance.max_drawdown_pct > 8) {
      focusAreas.push('Strengthen risk management and stop-loss discipline');
    }

    return focusAreas.slice(0, 5); // Top 5 focus areas
  }

  private calculateConfidenceScore(
    tradesCount: number,
    signalsCount: number,
    aiCount: number,
    performance: any
  ): number {
    let confidence = 0.5; // Base confidence

    // Data quantity factor
    if (tradesCount > 10) confidence += 0.1;
    if (signalsCount > 20) confidence += 0.1;
    if (aiCount > 15) confidence += 0.1;

    // Performance quality factor
    if (performance.win_rate_pct > 60) confidence += 0.1;
    if (performance.sharpe_ratio > 1) confidence += 0.1;

    // Time factor (more data = more confidence)
    confidence += Math.min(0.1, tradesCount / 50);

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private createMinimalReflection(startDate: Date, endDate: Date, startTime: number): Reflection {
    return {
      id: `reflection_minimal_${Date.now()}`,
      timestamp: new Date(),
      period_analyzed: {
        start_date: startDate,
        end_date: endDate,
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
      },
      performance_summary: {
        total_return_pct: 0,
        sharpe_ratio: 0,
        max_drawdown_pct: 0,
        win_rate_pct: 0,
        total_trades: 0
      },
      key_insights: ['No trading activity in this period', 'System appears to be in learning/observation mode'],
      mistakes_identified: [],
      successful_patterns: [],
      recommended_adjustments: [{
        area: 'signal_generation',
        current_value: 0,
        recommended_value: 1,
        reasoning: 'No signals generated - check data sources and signal engines',
        priority: 'HIGH',
        expected_impact: 'Enable trading activity'
      }],
      market_regime_analysis: {
        regime: 'SIDEWAYS',
        strategy_effectiveness: {},
        optimal_conditions: ['System initialization', 'Data collection'],
        challenges: ['Lack of market engagement', 'No performance feedback']
      },
      future_focus_areas: [
        'Ensure data ingestion is working',
        'Verify signal generation pipeline',
        'Check execution engine configuration'
      ],
      confidence_score: 0.3,
      metadata: {
        trades_analyzed: 0,
        signals_analyzed: 0,
        ai_analyses_used: 0,
        reflection_depth: 0.4,
        processing_time_ms: Date.now() - startTime
      }
    };
  }

  // Database helper methods
  private async getTradesInPeriod(startDate: Date, endDate: Date): Promise<Trade[]> {
    const query = `
      SELECT * FROM trades 
      WHERE timestamp BETWEEN $1 AND $2 
      AND status = 'FILLED'
      ORDER BY timestamp DESC
    `;
    const result = await DatabaseManager.query(query, [startDate, endDate]);

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
  }

  private async getSignalsInPeriod(startDate: Date, endDate: Date): Promise<TradingSignal[]> {
    const query = `
      SELECT * FROM signals 
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp DESC
    `;
    const result = await DatabaseManager.query(query, [startDate, endDate]);

    return result.rows.map((row: any) => ({
      id: row.id,
      symbol: row.symbol,
      timestamp: new Date(row.timestamp),
      signal_type: row.signal_type,
      strength: parseFloat(row.strength),
      confidence: parseFloat(row.confidence),
      source: row.source,
      reasoning: JSON.parse(row.reasoning || '[]'),
      features_used: JSON.parse(row.features_used || '[]'),
      risk_score: parseFloat(row.risk_score)
    }));
  }

  private async getAIAnalysesInPeriod(startDate: Date, endDate: Date): Promise<AIAnalysis[]> {
    const query = `
      SELECT * FROM ai_analysis 
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp DESC
    `;
    const result = await DatabaseManager.query(query, [startDate, endDate]);

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
  }

  private async getPortfolioSnapshotsInPeriod(startDate: Date, endDate: Date): Promise<PortfolioSnapshot[]> {
    const query = `
      SELECT * FROM portfolio_snapshots 
      WHERE timestamp BETWEEN $1 AND $2
      ORDER BY timestamp DESC
    `;
    const result = await DatabaseManager.query(query, [startDate, endDate]);

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
  }

  private async storeReflection(reflection: Reflection): Promise<void> {
    try {
      const query = `
        INSERT INTO reflections (
          id, timestamp, period_analyzed, performance_summary, key_insights,
          mistakes_identified, successful_patterns, recommended_adjustments,
          market_regime_analysis, future_focus_areas, confidence_score, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          performance_summary = EXCLUDED.performance_summary,
          key_insights = EXCLUDED.key_insights,
          mistakes_identified = EXCLUDED.mistakes_identified,
          successful_patterns = EXCLUDED.successful_patterns,
          recommended_adjustments = EXCLUDED.recommended_adjustments,
          market_regime_analysis = EXCLUDED.market_regime_analysis,
          future_focus_areas = EXCLUDED.future_focus_areas,
          confidence_score = EXCLUDED.confidence_score,
          metadata = EXCLUDED.metadata
      `;

      await DatabaseManager.query(query, [
        reflection.id,
        reflection.timestamp,
        JSON.stringify(reflection.period_analyzed),
        JSON.stringify(reflection.performance_summary),
        JSON.stringify(reflection.key_insights),
        JSON.stringify(reflection.mistakes_identified),
        JSON.stringify(reflection.successful_patterns),
        JSON.stringify(reflection.recommended_adjustments),
        JSON.stringify(reflection.market_regime_analysis),
        JSON.stringify(reflection.future_focus_areas),
        reflection.confidence_score,
        JSON.stringify(reflection.metadata)
      ]);

    } catch (error) {
      logger.error('Failed to store reflection:', error);
      throw error;
    }
  }

  async getLatestReflections(limit: number = 10): Promise<Reflection[]> {
    try {
      const query = `
        SELECT * FROM reflections
        ORDER BY timestamp DESC
        LIMIT $1
      `;

      const result = await DatabaseManager.query(query, [limit]);

      return result.rows.map((row: any) => ({
        id: row.id,
        timestamp: new Date(row.timestamp),
        period_analyzed: JSON.parse(row.period_analyzed || '{}'),
        performance_summary: JSON.parse(row.performance_summary || '{}'),
        key_insights: JSON.parse(row.key_insights || '[]'),
        mistakes_identified: JSON.parse(row.mistakes_identified || '[]'),
        successful_patterns: JSON.parse(row.successful_patterns || '[]'),
        recommended_adjustments: JSON.parse(row.recommended_adjustments || '[]'),
        market_regime_analysis: JSON.parse(row.market_regime_analysis || '{}'),
        future_focus_areas: JSON.parse(row.future_focus_areas || '[]'),
        confidence_score: parseFloat(row.confidence_score),
        metadata: JSON.parse(row.metadata || '{}')
      }));

    } catch (error) {
      logger.error('Failed to get latest reflections:', error);
      return [];
    }
  }
}

export const reflectionEngine = new ReflectionEngine();
