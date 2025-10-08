"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signalEngine = exports.SignalEngine = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
class MomentumStrategy {
    constructor() {
        this.name = 'momentum_crossover';
        this.weight = 0.25;
    }
    generateSignals(features) {
        const { features: f } = features;
        const reasoning = [];
        const ema_bullish = f.ema_12 > f.ema_26;
        const sma_trend = f.sma_5 > f.sma_10 && f.sma_10 > f.sma_20;
        let signal_type = 'HOLD';
        let strength = 0;
        let confidence = 0.6;
        if (ema_bullish && sma_trend) {
            signal_type = 'BUY';
            strength = Math.min(1, (f.ema_12 - f.ema_26) / f.ema_26 * 10);
            reasoning.push('EMA 12 > EMA 26 (bullish crossover)');
            reasoning.push('SMA uptrend confirmed (5>10>20)');
            if (f.volume_ratio > 1.5) {
                strength *= 1.2;
                reasoning.push('High volume confirmation');
                confidence += 0.1;
            }
        }
        else if (!ema_bullish && !sma_trend) {
            signal_type = 'SELL';
            strength = Math.min(1, (f.ema_26 - f.ema_12) / f.ema_12 * 10);
            reasoning.push('EMA 12 < EMA 26 (bearish crossover)');
            reasoning.push('SMA downtrend confirmed');
        }
        const vol_regime = f.volatility_20 > 30 ? 'high' : f.volatility_20 > 15 ? 'medium' : 'low';
        if (vol_regime === 'high') {
            strength *= 0.8;
            confidence *= 0.9;
        }
        if (signal_type === 'HOLD')
            return null;
        return {
            symbol: features.symbol,
            timestamp: features.timestamp,
            signal_type,
            strength: Math.max(0, Math.min(1, strength)),
            confidence: Math.max(0, Math.min(1, confidence)),
            source: this.name,
            reasoning,
            features_used: ['ema_12', 'ema_26', 'sma_5', 'sma_10', 'sma_20', 'volume_ratio', 'volatility_20'],
            target_price: signal_type === 'BUY' ? f.price * 1.05 : f.price * 0.95,
            stop_loss: signal_type === 'BUY' ? f.price * 0.98 : f.price * 1.02,
            take_profit: signal_type === 'BUY' ? f.price * 1.08 : f.price * 0.92,
            risk_score: vol_regime === 'high' ? 0.8 : vol_regime === 'medium' ? 0.5 : 0.3,
            metadata: {
                strategy_params: { ema_fast: 12, ema_slow: 26 },
                market_conditions: sma_trend ? 'trending' : 'choppy',
                volatility_regime: vol_regime
            }
        };
    }
}
class MeanReversionStrategy {
    constructor() {
        this.name = 'mean_reversion';
        this.weight = 0.25;
    }
    generateSignals(features) {
        const { features: f } = features;
        const reasoning = [];
        let signal_type = 'HOLD';
        let strength = 0;
        let confidence = 0.6;
        if (f.rsi_oversold && f.bb_percent_b < 0.2) {
            signal_type = 'BUY';
            strength = (30 - f.rsi_14) / 30;
            reasoning.push(`RSI oversold: ${f.rsi_14.toFixed(1)}`);
            reasoning.push(`Below lower Bollinger Band (${f.bb_percent_b.toFixed(2)})`);
            confidence = 0.7;
        }
        else if (f.rsi_overbought && f.bb_percent_b > 0.8) {
            signal_type = 'SELL';
            strength = (f.rsi_14 - 70) / 30;
            reasoning.push(`RSI overbought: ${f.rsi_14.toFixed(1)}`);
            reasoning.push(`Above upper Bollinger Band (${f.bb_percent_b.toFixed(2)})`);
            confidence = 0.7;
        }
        const near_support = Math.abs(f.price - f.support_level) / f.price < 0.02;
        const near_resistance = Math.abs(f.price - f.resistance_level) / f.price < 0.02;
        if (signal_type === 'BUY' && near_support) {
            strength *= 1.3;
            reasoning.push('Near support level');
            confidence += 0.1;
        }
        else if (signal_type === 'SELL' && near_resistance) {
            strength *= 1.3;
            reasoning.push('Near resistance level');
            confidence += 0.1;
        }
        if (signal_type === 'HOLD')
            return null;
        const vol_regime = f.volatility_20 > 30 ? 'high' : f.volatility_20 > 15 ? 'medium' : 'low';
        return {
            symbol: features.symbol,
            timestamp: features.timestamp,
            signal_type,
            strength: Math.max(0, Math.min(1, strength)),
            confidence: Math.max(0, Math.min(1, confidence)),
            source: this.name,
            reasoning,
            features_used: ['rsi_14', 'bb_percent_b', 'support_level', 'resistance_level', 'price'],
            target_price: signal_type === 'BUY' ? f.support_level * 1.02 : f.resistance_level * 0.98,
            stop_loss: signal_type === 'BUY' ? f.support_level * 0.99 : f.resistance_level * 1.01,
            risk_score: vol_regime === 'high' ? 0.7 : 0.4,
            metadata: {
                strategy_params: { rsi_oversold: 30, rsi_overbought: 70 },
                market_conditions: near_support || near_resistance ? 'at_level' : 'normal',
                volatility_regime: vol_regime
            }
        };
    }
}
class BreakoutStrategy {
    constructor() {
        this.name = 'breakout';
        this.weight = 0.2;
    }
    generateSignals(features) {
        const { features: f } = features;
        const reasoning = [];
        const upper_breakout = f.price > f.bb_upper && f.volume_ratio > 1.5;
        const lower_breakout = f.price < f.bb_lower && f.volume_ratio > 1.5;
        let signal_type = 'HOLD';
        let strength = 0;
        let confidence = 0.65;
        if (upper_breakout && !f.bb_squeeze) {
            signal_type = 'BUY';
            strength = Math.min(1, (f.price - f.bb_upper) / f.bb_upper * 20);
            reasoning.push('Upper Bollinger Band breakout');
            reasoning.push(`High volume: ${f.volume_ratio.toFixed(2)}x average`);
        }
        else if (lower_breakout && !f.bb_squeeze) {
            signal_type = 'SELL';
            strength = Math.min(1, (f.bb_lower - f.price) / f.price * 20);
            reasoning.push('Lower Bollinger Band breakdown');
            reasoning.push(`High volume: ${f.volume_ratio.toFixed(2)}x average`);
        }
        const resistance_break = f.price > f.resistance_level * 1.01 && f.volume_ratio > 2;
        const support_break = f.price < f.support_level * 0.99 && f.volume_ratio > 2;
        if (resistance_break) {
            signal_type = 'BUY';
            strength = Math.max(strength, (f.price - f.resistance_level) / f.resistance_level * 15);
            reasoning.push('Resistance level breakout');
            confidence = 0.75;
        }
        else if (support_break) {
            signal_type = 'SELL';
            strength = Math.max(strength, (f.support_level - f.price) / f.price * 15);
            reasoning.push('Support level breakdown');
            confidence = 0.75;
        }
        if (signal_type === 'HOLD')
            return null;
        const vol_regime = f.volatility_20 > 30 ? 'high' : f.volatility_20 > 15 ? 'medium' : 'low';
        return {
            symbol: features.symbol,
            timestamp: features.timestamp,
            signal_type,
            strength: Math.max(0, Math.min(1, strength)),
            confidence,
            source: this.name,
            reasoning,
            features_used: ['bb_upper', 'bb_lower', 'price', 'volume_ratio', 'resistance_level', 'support_level'],
            target_price: signal_type === 'BUY' ? f.price * 1.08 : f.price * 0.92,
            stop_loss: signal_type === 'BUY' ? f.price * 0.96 : f.price * 1.04,
            risk_score: vol_regime === 'high' ? 0.9 : 0.6,
            metadata: {
                strategy_params: { breakout_threshold: 0.01 },
                market_conditions: 'breakout',
                volatility_regime: vol_regime
            }
        };
    }
}
class PatternStrategy {
    constructor() {
        this.name = 'candlestick_patterns';
        this.weight = 0.15;
    }
    generateSignals(features) {
        const { features: f } = features;
        const reasoning = [];
        let signal_type = 'HOLD';
        let strength = 0.3;
        let confidence = 0.5;
        if (f.hammer && f.trend_long === 'down') {
            signal_type = 'BUY';
            reasoning.push('Hammer pattern at downtrend');
            confidence = 0.6;
        }
        else if (f.engulfing_bullish) {
            signal_type = 'BUY';
            reasoning.push('Bullish engulfing pattern');
            confidence = 0.65;
        }
        else if (f.engulfing_bearish) {
            signal_type = 'SELL';
            reasoning.push('Bearish engulfing pattern');
            confidence = 0.65;
        }
        else if (f.doji && f.rsi_overbought) {
            signal_type = 'SELL';
            reasoning.push('Doji at overbought levels');
            confidence = 0.55;
        }
        if (signal_type === 'HOLD')
            return null;
        const vol_regime = f.volatility_20 > 30 ? 'high' : f.volatility_20 > 15 ? 'medium' : 'low';
        return {
            symbol: features.symbol,
            timestamp: features.timestamp,
            signal_type,
            strength,
            confidence,
            source: this.name,
            reasoning,
            features_used: ['hammer', 'engulfing_bullish', 'engulfing_bearish', 'doji', 'trend_long', 'rsi_overbought'],
            target_price: signal_type === 'BUY' ? f.price * 1.03 : f.price * 0.97,
            stop_loss: signal_type === 'BUY' ? f.price * 0.99 : f.price * 1.01,
            risk_score: 0.5,
            metadata: {
                strategy_params: { pattern_strength: strength },
                market_conditions: 'pattern_detected',
                volatility_regime: vol_regime
            }
        };
    }
}
class SignalEngine {
    constructor() {
        this.strategies = [];
        this.strategies = [
            new MomentumStrategy(),
            new MeanReversionStrategy(),
            new BreakoutStrategy(),
            new PatternStrategy()
        ];
    }
    async generateSignals(features) {
        const allSignals = [];
        for (const featureSet of features) {
            try {
                const strategySignals = this.strategies
                    .map(strategy => strategy.generateSignals(featureSet))
                    .filter(signal => signal !== null);
                if (strategySignals.length === 0)
                    continue;
                const ensembleSignal = this.createEnsembleSignal(strategySignals, featureSet);
                if (ensembleSignal) {
                    await this.storeSignal(ensembleSignal);
                    allSignals.push(ensembleSignal);
                    logger_1.logger.info(`Generated signal for ${featureSet.symbol}`, {
                        signal: ensembleSignal.signal_type,
                        strength: ensembleSignal.strength,
                        confidence: ensembleSignal.confidence,
                        strategies_count: strategySignals.length
                    });
                }
                for (const signal of strategySignals) {
                    await this.storeSignal(signal);
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to generate signals for ${featureSet.symbol}:`, error);
            }
        }
        return allSignals;
    }
    createEnsembleSignal(signals, features) {
        if (signals.length === 0)
            return null;
        const buySignals = signals.filter(s => s.signal_type === 'BUY');
        const sellSignals = signals.filter(s => s.signal_type === 'SELL');
        const buyScore = buySignals.reduce((sum, signal) => {
            const strategy = this.strategies.find(s => s.name === signal.source);
            return sum + (signal.strength * signal.confidence * (strategy?.weight || 0.1));
        }, 0);
        const sellScore = sellSignals.reduce((sum, signal) => {
            const strategy = this.strategies.find(s => s.name === signal.source);
            return sum + (signal.strength * signal.confidence * (strategy?.weight || 0.1));
        }, 0);
        let signal_type;
        let strength;
        let confidence;
        let reasoning = [];
        const totalWeight = this.strategies.reduce((sum, s) => sum + s.weight, 0);
        const threshold = totalWeight * 0.15;
        if (buyScore > sellScore && buyScore > threshold) {
            signal_type = 'BUY';
            strength = Math.min(1, buyScore / (totalWeight * 0.5));
            confidence = buySignals.reduce((sum, s) => sum + s.confidence, 0) / buySignals.length;
            reasoning.push(`Ensemble BUY: ${buySignals.length} strategies agree (score: ${buyScore.toFixed(2)})`);
            reasoning.push(...buySignals.map(s => `${s.source}: ${s.reasoning.join(', ')}`));
        }
        else if (sellScore > buyScore && sellScore > threshold) {
            signal_type = 'SELL';
            strength = Math.min(1, sellScore / (totalWeight * 0.5));
            confidence = sellSignals.reduce((sum, s) => sum + s.confidence, 0) / sellSignals.length;
            reasoning.push(`Ensemble SELL: ${sellSignals.length} strategies agree (score: ${sellScore.toFixed(2)})`);
            reasoning.push(...sellSignals.map(s => `${s.source}: ${s.reasoning.join(', ')}`));
        }
        else {
            return null;
        }
        const allFeaturesUsed = [...new Set(signals.flatMap(s => s.features_used))];
        const avgTargetPrice = signals.reduce((sum, s) => sum + (s.target_price || features.features.price), 0) / signals.length;
        const avgStopLoss = signals.reduce((sum, s) => sum + (s.stop_loss || features.features.price), 0) / signals.length;
        const vol_regime = features.features.volatility_20 > 30 ? 'high' : features.features.volatility_20 > 15 ? 'medium' : 'low';
        return {
            symbol: features.symbol,
            timestamp: features.timestamp,
            signal_type,
            strength: Math.max(0, Math.min(1, strength)),
            confidence: Math.max(0, Math.min(1, confidence)),
            source: 'ensemble',
            reasoning,
            features_used: allFeaturesUsed,
            target_price: avgTargetPrice,
            stop_loss: avgStopLoss,
            risk_score: Math.max(...signals.map(s => s.risk_score)),
            metadata: {
                strategy_params: {
                    buy_score: buyScore,
                    sell_score: sellScore,
                    strategies_count: signals.length,
                    consensus_strength: Math.abs(buyScore - sellScore) / Math.max(buyScore, sellScore, 0.001)
                },
                market_conditions: 'ensemble_analysis',
                volatility_regime: vol_regime
            }
        };
    }
    async storeSignal(signal) {
        try {
            const query = `
        INSERT INTO signals (
          symbol, timestamp, signal_type, strength, confidence, source,
          reasoning, features_used, target_price, stop_loss, take_profit, 
          risk_score, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (symbol, timestamp, source) DO UPDATE SET
          signal_type = EXCLUDED.signal_type,
          strength = EXCLUDED.strength,
          confidence = EXCLUDED.confidence,
          reasoning = EXCLUDED.reasoning,
          features_used = EXCLUDED.features_used,
          target_price = EXCLUDED.target_price,
          stop_loss = EXCLUDED.stop_loss,
          take_profit = EXCLUDED.take_profit,
          risk_score = EXCLUDED.risk_score,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `;
            await database_1.DatabaseManager.query(query, [
                signal.symbol,
                signal.timestamp,
                signal.signal_type,
                signal.strength,
                signal.confidence,
                signal.source,
                JSON.stringify(signal.reasoning),
                JSON.stringify(signal.features_used),
                signal.target_price,
                signal.stop_loss,
                signal.take_profit,
                signal.risk_score,
                JSON.stringify(signal.metadata)
            ]);
        }
        catch (error) {
            logger_1.logger.error('Failed to store signal:', error);
            throw error;
        }
    }
    async getLatestSignals(symbols, limit = 20) {
        try {
            const query = `
        SELECT *
        FROM signals
        WHERE symbol = ANY($1) AND timestamp >= NOW() - INTERVAL '1 day'
        ORDER BY timestamp DESC, confidence DESC
        LIMIT $2
      `;
            const result = await database_1.DatabaseManager.query(query, [symbols, limit]);
            return result.rows.map((row) => ({
                id: row.id,
                symbol: row.symbol,
                timestamp: new Date(row.timestamp),
                signal_type: row.signal_type,
                strength: parseFloat(row.strength),
                confidence: parseFloat(row.confidence),
                source: row.source,
                reasoning: JSON.parse(row.reasoning || '[]'),
                features_used: JSON.parse(row.features_used || '[]'),
                target_price: row.target_price ? parseFloat(row.target_price) : undefined,
                stop_loss: row.stop_loss ? parseFloat(row.stop_loss) : undefined,
                take_profit: row.take_profit ? parseFloat(row.take_profit) : undefined,
                risk_score: parseFloat(row.risk_score),
                metadata: JSON.parse(row.metadata || '{}')
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get latest signals:', error);
            throw error;
        }
    }
}
exports.SignalEngine = SignalEngine;
exports.signalEngine = new SignalEngine();
