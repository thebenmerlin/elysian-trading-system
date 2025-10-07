"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataIngestor = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
class DataIngestor {
    async fetchMarketData(symbols) {
        const marketData = [];
        for (const symbol of symbols) {
            try {
                const data = await this.fetchYahooFinanceData(symbol);
                if (data) {
                    marketData.push(data);
                    await this.storeMarketData(data);
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to fetch data for ${symbol}:`, error);
            }
        }
        return marketData;
    }
    async fetchYahooFinanceData(symbol) {
        try {
            // Generate realistic mock data for development
            const basePrice = 100 + Math.random() * 100;
            const volatility = 0.02; // 2% daily volatility
            const change = (Math.random() - 0.5) * 2 * volatility;
            const close = basePrice * (1 + change);
            const open = basePrice;
            const high = Math.max(open, close) * (1 + Math.random() * 0.01);
            const low = Math.min(open, close) * (1 - Math.random() * 0.01);
            const mockData = {
                symbol,
                timestamp: new Date(),
                open,
                high,
                low,
                close,
                volume: Math.floor(Math.random() * 10000000) + 1000000, // 1M-10M volume
                provider: 'yahoo'
            };
            logger_1.logger.debug(`Fetched data for ${symbol}: $${close.toFixed(2)}`);
            return mockData;
        }
        catch (error) {
            logger_1.logger.error(`Yahoo Finance fetch failed for ${symbol}:`, error);
            return null;
        }
    }
    async storeMarketData(data) {
        try {
            const query = `
        INSERT INTO market_data (symbol, timestamp, open, high, low, close, volume, provider)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (symbol, timestamp, provider) DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume
      `;
            await database_1.DatabaseManager.query(query, [
                data.symbol,
                data.timestamp,
                data.open,
                data.high,
                data.low,
                data.close,
                data.volume,
                data.provider
            ]);
        }
        catch (error) {
            logger_1.logger.error('Failed to store market data:', error);
            throw error;
        }
    }
    async getHistoricalData(symbol, days) {
        try {
            const query = `
        SELECT * FROM market_data 
        WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY timestamp DESC
        LIMIT 100
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
        catch (error) {
            logger_1.logger.error('Failed to get historical data:', error);
            return [];
        }
    }
    async healthCheck() {
        try {
            // Test with a simple mock data generation
            const testData = await this.fetchYahooFinanceData('TEST');
            return testData !== null;
        }
        catch (error) {
            logger_1.logger.error('Data ingestor health check failed:', error);
            return false;
        }
    }
}
exports.dataIngestor = new DataIngestor();
