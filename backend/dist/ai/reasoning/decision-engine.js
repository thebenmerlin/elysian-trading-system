"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiDecisionEngine = exports.AIDecisionEngine = void 0;
const logger_1 = require("../../utils/logger");
const database_1 = require("../../utils/database");
const events_1 = require("events");
class AIDecisionEngine extends events_1.EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.analysisInterval = 30000;
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        logger_1.logger.info('🧠 AI Decision Engine started');
        this.runContinuousAnalysis();
    }
    async stop() {
        this.isRunning = false;
        logger_1.logger.info('🧠 AI Decision Engine stopped');
    }
    async runContinuousAnalysis() {
        while (this.isRunning) {
            try {
                await this.analyzeAllAssets();
                await this.sleep(this.analysisInterval);
            }
            catch (error) {
                logger_1.logger.error('Error in continuous analysis:', error);
                await this.sleep(5000);
            }
        }
    }
    async analyzeAllAssets() {
        try {
            const assetsQuery = `
        SELECT symbol, asset_type, price, volume, last_updated
        FROM assets_live
        WHERE last_updated > NOW() - INTERVAL '5 minutes'
        ORDER BY asset_type, symbol
      `;
            const assetsResult = await database_1.DatabaseManager.query(assetsQuery);
            for (const asset of assetsResult.rows) {
                try {
                    const features = await this.calculateFeatures(asset.symbol, asset.asset_type);
                    if (features) {
                        const signal = await this.generateSignal(features);
                        if (signal && signal.signal_type !== 'HOLD') {
                            await this.storeSignal(signal);
                            this.emit('signal', signal);
                            logger_1.logger.info(`🎯 Signal generated: ${signal.signal_type} ${signal.symbol} (${signal.confidence.toFixed(2)})`);
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.error(`Error analyzing ${asset.symbol}:`, error);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Error in analyzeAllAssets:', error);
        }
    }
    async calculateFeatures(symbol, assetType) {
        try {
            const priceQuery = `
        SELECT close, volume, timestamp
        FROM price_feeds
        WHERE symbol = $1 AND asset_type = $2
        ORDER BY timestamp DESC
        LIMIT 100
      `;
            const priceResult = await database_1.DatabaseManager.query(priceQuery, [symbol, assetType]);
            if (priceResult.rows.length < 20) {
                return null;
            }
            const prices = priceResult.rows.map(row => parseFloat(row.close));
            const volumes = priceResult.rows.map(row => parseFloat(row.volume || 0));
            const currentPrice = prices[0];
            const currentVolume = volumes[0];
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
        }
        catch (error) {
            logger_1.logger.error(`Error calculating features for ${symbol}:`, error);
            return null;
        }
    }
    async generateSignal(features) {
        try {
            let signalType = 'HOLD';
            let confidence = 0;
            let reasoning = '';
            const signals = [];
            if (features.rsi < 30) {
                signals.push({ type: 'BUY', weight: 0.3, reason: 'RSI oversold' });
            }
            else if (features.rsi > 70) {
                signals.push({ type: 'SELL', weight: 0.3, reason: 'RSI overbought' });
            }
            if (features.macd > 0) {
                signals.push({ type: 'BUY', weight: 0.25, reason: 'MACD bullish crossover' });
            }
            else if (features.macd < -0.1) {
                signals.push({ type: 'SELL', weight: 0.25, reason: 'MACD bearish crossover' });
            }
            if (features.bollinger_position < 0.2) {
                signals.push({ type: 'BUY', weight: 0.2, reason: 'Price near lower Bollinger band' });
            }
            else if (features.bollinger_position > 0.8) {
                signals.push({ type: 'SELL', weight: 0.2, reason: 'Price near upper Bollinger band' });
            }
            if (features.volume_sma_ratio > 1.5) {
                signals.push({ type: 'BUY', weight: 0.15, reason: 'High volume confirmation' });
            }
            if (features.price_change_24h > 5 && features.price_change_1h > 0) {
                signals.push({ type: 'BUY', weight: 0.1, reason: 'Strong upward momentum' });
            }
            else if (features.price_change_24h < -5 && features.price_change_1h < 0) {
                signals.push({ type: 'SELL', weight: 0.1, reason: 'Strong downward momentum' });
            }
            const buyWeight = signals.filter(s => s.type === 'BUY').reduce((sum, s) => sum + s.weight, 0);
            const sellWeight = signals.filter(s => s.type === 'SELL').reduce((sum, s) => sum + s.weight, 0);
            if (buyWeight > sellWeight && buyWeight > 0.4) {
                signalType = 'BUY';
                confidence = Math.min(buyWeight, 0.95);
                reasoning = signals.filter(s => s.type === 'BUY').map(s => s.reason).join('; ');
            }
            else if (sellWeight > buyWeight && sellWeight > 0.4) {
                signalType = 'SELL';
                confidence = Math.min(sellWeight, 0.95);
                reasoning = signals.filter(s => s.type === 'SELL').map(s => s.reason).join('; ');
            }
            if (features.asset_type === 'crypto') {
                confidence *= 0.9;
            }
            if (confidence < 0.5) {
                signalType = 'HOLD';
                reasoning = 'Insufficient confidence for trade signal';
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
        }
        catch (error) {
            logger_1.logger.error('Error generating signal:', error);
            return null;
        }
    }
    calculateTargetPrice(features, signalType) {
        if (signalType === 'HOLD')
            return undefined;
        const volatilityMultiplier = features.asset_type === 'crypto' ? 1.5 : 1.0;
        const targetMove = features.volatility * volatilityMultiplier * 0.02;
        if (signalType === 'BUY') {
            return features.price * (1 + targetMove);
        }
        else {
            return features.price * (1 - targetMove);
        }
    }
    calculateStopLoss(features, signalType) {
        if (signalType === 'HOLD')
            return undefined;
        const riskPercentage = features.asset_type === 'crypto' ? 0.05 : 0.03;
        if (signalType === 'BUY') {
            return features.price * (1 - riskPercentage);
        }
        else {
            return features.price * (1 + riskPercentage);
        }
    }
    async storeSignal(signal) {
        try {
            const query = `
        INSERT INTO ai_signals (
          symbol, asset_type, signal_type, confidence, reasoning, 
          features, price_at_signal, timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id
      `;
            const result = await database_1.DatabaseManager.query(query, [
                signal.symbol,
                signal.asset_type,
                signal.signal_type,
                signal.confidence,
                signal.reasoning,
                JSON.stringify(signal.features),
                signal.price_at_signal
            ]);
            await database_1.DatabaseManager.query(`INSERT INTO system_events (event_type, event_data) VALUES ('AI_SIGNAL', $1)`, [JSON.stringify({
                    signal_id: result.rows[0].id,
                    symbol: signal.symbol,
                    signal_type: signal.signal_type,
                    confidence: signal.confidence
                })]);
        }
        catch (error) {
            logger_1.logger.error('Failed to store signal:', error);
            throw error;
        }
    }
    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1)
            return 50;
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = prices[i - 1] - prices[i];
            if (change > 0) {
                gains += change;
            }
            else {
                losses -= change;
            }
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0)
            return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    calculateMACD(prices) {
        if (prices.length < 26)
            return 0;
        const ema12 = this.calculateEMA(prices.slice(0, 12), 12);
        const ema26 = this.calculateEMA(prices.slice(0, 26), 26);
        return ema12 - ema26;
    }
    calculateEMA(prices, period) {
        if (prices.length === 0)
            return 0;
        const multiplier = 2 / (period + 1);
        let ema = prices[prices.length - 1];
        for (let i = prices.length - 2; i >= 0; i--) {
            ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
        }
        return ema;
    }
    calculateBollingerPosition(prices, period = 20) {
        if (prices.length < period)
            return 0.5;
        const recentPrices = prices.slice(0, period);
        const sma = recentPrices.reduce((sum, p) => sum + p, 0) / period;
        const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        const upperBand = sma + (2 * stdDev);
        const lowerBand = sma - (2 * stdDev);
        const currentPrice = prices[0];
        return (currentPrice - lowerBand) / (upperBand - lowerBand);
    }
    calculateVolumeSMAR(volumes, period = 20) {
        if (volumes.length < period)
            return 1;
        const currentVolume = volumes[0];
        const avgVolume = volumes.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
        return avgVolume > 0 ? currentVolume / avgVolume : 1;
    }
    calculatePriceChange(prices, periods) {
        if (prices.length <= periods)
            return 0;
        const currentPrice = prices[0];
        const pastPrice = prices[periods];
        return ((currentPrice - pastPrice) / pastPrice) * 100;
    }
    calculateVolatility(prices, period = 20) {
        if (prices.length < period)
            return 0;
        const recentPrices = prices.slice(0, period);
        const returns = [];
        for (let i = 1; i < recentPrices.length; i++) {
            returns.push((recentPrices[i - 1] - recentPrices[i]) / recentPrices[i]);
        }
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        return Math.sqrt(variance) * 100;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.AIDecisionEngine = AIDecisionEngine;
exports.aiDecisionEngine = new AIDecisionEngine();
