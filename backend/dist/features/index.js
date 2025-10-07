"use strict";
/**
 * Elysian Trading System - Features Engine
 * Technical indicators and feature computation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.featuresEngine = exports.FeaturesEngine = void 0;
const logger_1 = require("@/utils/logger");
const database_1 = require("@/utils/database");
const technicalindicators_1 = require("technicalindicators");
class FeaturesEngine {
    async computeFeatures(symbols) {
        const features = [];
        for (const symbol of symbols) {
            try {
                const startTime = Date.now();
                // Get historical data (last 100 days for sufficient indicators)
                const historicalData = await this.getHistoricalData(symbol, 100);
                if (historicalData.length < 50) {
                    logger_1.logger.warn(`Insufficient data for ${symbol}: ${historicalData.length} records`);
                    continue;
                }
                const featureSet = await this.computeSymbolFeatures(symbol, historicalData);
                featureSet.metadata.computation_time_ms = Date.now() - startTime;
                // Store features in database
                await this.storeFeatures(featureSet);
                features.push(featureSet);
                logger_1.logger.debug(`Computed features for ${symbol}`, {
                    data_points: historicalData.length,
                    computation_time: featureSet.metadata.computation_time_ms
                });
            }
            catch (error) {
                logger_1.logger.error(`Failed to compute features for ${symbol}:`, error);
            }
        }
        return features;
    }
    async computeSymbolFeatures(symbol, data) {
        // Sort data by timestamp
        data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const closes = data.map(d => d.close);
        const highs = data.map(d => d.high);
        const lows = data.map(d => d.low);
        const volumes = data.map(d => d.volume);
        const latest = data[data.length - 1];
        // Basic price features
        const price = latest.close;
        const prevPrice = data[data.length - 2]?.close || price;
        const price_change = price - prevPrice;
        const price_change_pct = (price_change / prevPrice) * 100;
        // Moving averages
        const sma_5 = this.last(technicalindicators_1.SMA.calculate({ period: 5, values: closes }));
        const sma_10 = this.last(technicalindicators_1.SMA.calculate({ period: 10, values: closes }));
        const sma_20 = this.last(technicalindicators_1.SMA.calculate({ period: 20, values: closes }));
        const sma_50 = this.last(technicalindicators_1.SMA.calculate({ period: 50, values: closes }));
        const ema_12 = this.last(technicalindicators_1.EMA.calculate({ period: 12, values: closes }));
        const ema_26 = this.last(technicalindicators_1.EMA.calculate({ period: 26, values: closes }));
        // RSI
        const rsi_14 = this.last(technicalindicators_1.RSI.calculate({ period: 14, values: closes }));
        const rsi_overbought = rsi_14 > 70;
        const rsi_oversold = rsi_14 < 30;
        // MACD
        const macdData = technicalindicators_1.MACD.calculate({
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            values: closes,
            SimpleMAOscillator: false,
            SimpleMASignal: false
        });
        const latestMacd = macdData[macdData.length - 1] || { MACD: 0, signal: 0, histogram: 0 };
        const macd_line = latestMacd.MACD || 0;
        const macd_signal = latestMacd.signal || 0;
        const macd_histogram = latestMacd.histogram || 0;
        const macd_bullish = macd_line > macd_signal;
        // Bollinger Bands
        const bbData = technicalindicators_1.BollingerBands.calculate({
            period: 20,
            stdDev: 2,
            values: closes
        });
        const latestBB = bbData[bbData.length - 1] || { upper: price, middle: price, lower: price, pb: 0.5 };
        const bb_upper = latestBB.upper || price;
        const bb_middle = latestBB.middle || price;
        const bb_lower = latestBB.lower || price;
        const bb_percent_b = latestBB.pb || 0.5;
        const bb_squeeze = (bb_upper - bb_lower) / bb_middle < 0.1;
        // Volume features
        const volume = latest.volume;
        const volume_sma_20 = this.last(technicalindicators_1.SMA.calculate({ period: 20, values: volumes }));
        const volume_ratio = volume_sma_20 > 0 ? volume / volume_sma_20 : 1;
        // Volatility (20-day standard deviation of returns)
        const returns = closes.slice(1).map((close, i) => (close - closes[i]) / closes[i]);
        const volatility_20 = this.calculateStdDev(returns.slice(-20)) * Math.sqrt(252) * 100; // Annualized
        // Support/Resistance levels
        const recent_lows = lows.slice(-20);
        const recent_highs = highs.slice(-20);
        const support_level = Math.min(...recent_lows);
        const resistance_level = Math.max(...recent_highs);
        // Trend detection
        const trend_short = sma_5 > sma_10 ? 'up' : sma_5 < sma_10 ? 'down' : 'sideways';
        const trend_long = sma_20 > sma_50 ? 'up' : sma_20 < sma_50 ? 'down' : 'sideways';
        // Simple pattern recognition
        const hammer = this.detectHammer(latest);
        const doji = this.detectDoji(latest);
        const engulfing_bullish = this.detectEngulfingBullish(data.slice(-2));
        const engulfing_bearish = this.detectEngulfingBearish(data.slice(-2));
        // Data quality assessment
        const data_quality_score = this.assessDataQuality(data);
        return {
            symbol,
            timestamp: latest.timestamp,
            features: {
                price,
                price_change,
                price_change_pct,
                sma_5,
                sma_10,
                sma_20,
                sma_50,
                ema_12,
                ema_26,
                rsi_14,
                rsi_overbought,
                rsi_oversold,
                macd_line,
                macd_signal,
                macd_histogram,
                macd_bullish,
                bb_upper,
                bb_middle,
                bb_lower,
                bb_percent_b,
                bb_squeeze,
                volume,
                volume_sma_20,
                volume_ratio,
                volatility_20,
                support_level,
                resistance_level,
                trend_short,
                trend_long,
                hammer,
                doji,
                engulfing_bullish,
                engulfing_bearish
            },
            metadata: {
                data_points_used: data.length,
                computation_time_ms: 0, // Set by caller
                data_quality_score
            }
        };
    }
    last(arr) {
        return arr && arr.length > 0 ? arr[arr.length - 1] : 0;
    }
    calculateStdDev(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    detectHammer(candle) {
        const body = Math.abs(candle.close - candle.open);
        const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
        const upperShadow = candle.high - Math.max(candle.open, candle.close);
        return lowerShadow > body * 2 && upperShadow < body * 0.1;
    }
    detectDoji(candle) {
        const body = Math.abs(candle.close - candle.open);
        const range = candle.high - candle.low;
        return body < range * 0.05; // Body is less than 5% of total range
    }
    detectEngulfingBullish(candles) {
        if (candles.length < 2)
            return false;
        const prev = candles[0];
        const curr = candles[1];
        return prev.close < prev.open && // Previous bearish
            curr.close > curr.open && // Current bullish
            curr.open < prev.close && // Current opens below prev close
            curr.close > prev.open; // Current closes above prev open
    }
    detectEngulfingBearish(candles) {
        if (candles.length < 2)
            return false;
        const prev = candles[0];
        const curr = candles[1];
        return prev.close > prev.open && // Previous bullish
            curr.close < curr.open && // Current bearish
            curr.open > prev.close && // Current opens above prev close
            curr.close < prev.open; // Current closes below prev open
    }
    assessDataQuality(data) {
        let score = 1.0;
        // Check for missing data
        const missingDataPenalty = data.filter(d => d.close <= 0 || d.volume <= 0).length / data.length;
        score -= missingDataPenalty * 0.3;
        // Check data freshness
        const latestData = data[data.length - 1];
        const ageHours = (Date.now() - latestData.timestamp.getTime()) / (1000 * 60 * 60);
        if (ageHours > 24)
            score -= 0.2;
        if (ageHours > 72)
            score -= 0.3;
        return Math.max(0, Math.min(1, score));
    }
    async getHistoricalData(symbol, days) {
        const query = `
      SELECT symbol, timestamp, open, high, low, close, volume, provider
      FROM market_data
      WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '${days} days'
      ORDER BY timestamp ASC
    `;
        const result = await database_1.DatabaseManager.query(query, [symbol]);
        return result.rows.map((row) => ({
            symbol: row.symbol,
            timestamp: new Date(row.timestamp),
            open: parseFloat(row.open),
            high: parseFloat(row.high),
            low: parseFloat(row.low),
            close: parseFloat(row.close),
            volume: parseInt(row.volume),
            provider: row.provider
        }));
    }
    async storeFeatures(featureSet) {
        try {
            const query = `
        INSERT INTO features (symbol, timestamp, features, metadata)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (symbol, timestamp) DO UPDATE SET
          features = EXCLUDED.features,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `;
            await database_1.DatabaseManager.query(query, [
                featureSet.symbol,
                featureSet.timestamp,
                JSON.stringify(featureSet.features),
                JSON.stringify(featureSet.metadata)
            ]);
        }
        catch (error) {
            logger_1.logger.error('Failed to store features:', error);
            throw error;
        }
    }
    async getLatestFeatures(symbols) {
        try {
            const query = `
        SELECT symbol, timestamp, features, metadata
        FROM features
        WHERE symbol = ANY($1)
        ORDER BY timestamp DESC
        LIMIT ${symbols.length}
      `;
            const result = await database_1.DatabaseManager.query(query, [symbols]);
            return result.rows.map((row) => ({
                symbol: row.symbol,
                timestamp: new Date(row.timestamp),
                features: row.features,
                metadata: row.metadata
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get latest features:', error);
            throw error;
        }
    }
}
exports.FeaturesEngine = FeaturesEngine;
exports.featuresEngine = new FeaturesEngine();
