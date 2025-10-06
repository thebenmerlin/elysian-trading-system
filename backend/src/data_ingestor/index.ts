/**
 * Elysian Trading System - Data Ingestor
 * Multi-source market data fetching and storage
 */

import axios from 'axios';
import { logger } from '@/utils/logger';
import { DatabaseManager } from '@/utils/database';

export interface MarketData {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  provider: string;
}

export interface DataSource {
  name: string;
  fetchData(symbol: string, period?: string): Promise<MarketData[]>;
  isAvailable(): Promise<boolean>;
}

class YahooFinanceSource implements DataSource {
  name = 'yahoo';

  async fetchData(symbol: string, period: string = '1d'): Promise<MarketData[]> {
    try {
      // Yahoo Finance API endpoint
      const interval = period === '1d' ? '1h' : '1d';
      const range = period === '1d' ? '1d' : '1mo';

      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      const response = await axios.get(url, {
        params: {
          range,
          interval,
          includePrePost: false
        },
        timeout: 10000
      });

      const result = response.data.chart.result[0];
      if (!result || !result.timestamp) {
        throw new Error(`No data returned for ${symbol}`);
      }

      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];

      return timestamps.map((timestamp: number, index: number) => ({
        symbol: symbol.toUpperCase(),
        timestamp: new Date(timestamp * 1000),
        open: quotes.open[index] || 0,
        high: quotes.high[index] || 0,
        low: quotes.low[index] || 0,
        close: quotes.close[index] || 0,
        volume: quotes.volume[index] || 0,
        provider: this.name
      })).filter(data => data.close > 0);

    } catch (error) {
      logger.error(`Yahoo Finance fetch failed for ${symbol}:`, error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/AAPL', {
        timeout: 5000
      });
      return true;
    } catch {
      return false;
    }
  }
}

class AlphaVantageSource implements DataSource {
  name = 'alphavantage';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || '';
  }

  async fetchData(symbol: string, period: string = '1d'): Promise<MarketData[]> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not configured');
    }

    try {
      const func = period === '1d' ? 'TIME_SERIES_INTRADAY' : 'TIME_SERIES_DAILY';
      const interval = period === '1d' ? '60min' : undefined;

      const response = await axios.get('https://www.alphavantage.co/query', {
        params: {
          function: func,
          symbol,
          apikey: this.apiKey,
          ...(interval && { interval })
        },
        timeout: 15000
      });

      const data = response.data;
      const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'));

      if (!timeSeriesKey || !data[timeSeriesKey]) {
        throw new Error('Invalid Alpha Vantage response');
      }

      const timeSeries = data[timeSeriesKey];

      return Object.entries(timeSeries).map(([timestamp, values]: [string, any]) => ({
        symbol: symbol.toUpperCase(),
        timestamp: new Date(timestamp),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume']) || 0,
        provider: this.name
      })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    } catch (error) {
      logger.error(`Alpha Vantage fetch failed for ${symbol}:`, error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}

export class DataIngestor {
  private sources: DataSource[] = [];

  constructor() {
    this.sources.push(new YahooFinanceSource());
    if (process.env.ALPHA_VANTAGE_API_KEY) {
      this.sources.push(new AlphaVantageSource());
    }
  }

  async fetchMarketData(symbols: string[], period: string = '1d'): Promise<MarketData[]> {
    const allData: MarketData[] = [];

    for (const symbol of symbols) {
      let dataFetched = false;

      // Try each data source until successful
      for (const source of this.sources) {
        try {
          const available = await source.isAvailable();
          if (!available) continue;

          logger.info(`Fetching ${symbol} from ${source.name}`);
          const data = await source.fetchData(symbol, period);

          if (data && data.length > 0) {
            // Store in database
            await this.storeMarketData(data);
            allData.push(...data);
            dataFetched = true;

            logger.info(`Successfully fetched ${data.length} records for ${symbol} from ${source.name}`);
            break;
          }
        } catch (error) {
          logger.warn(`${source.name} failed for ${symbol}:`, error);
          continue;
        }
      }

      if (!dataFetched) {
        logger.error(`Failed to fetch data for ${symbol} from all sources`);
      }

      // Rate limiting between symbols
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return allData;
  }

  private async storeMarketData(data: MarketData[]): Promise<void> {
    try {
      const query = `
        INSERT INTO market_data (symbol, timestamp, open, high, low, close, volume, provider)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (symbol, timestamp, provider) DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume,
          updated_at = NOW()
      `;

      for (const record of data) {
        await DatabaseManager.query(query, [
          record.symbol,
          record.timestamp,
          record.open,
          record.high,
          record.low,
          record.close,
          record.volume,
          record.provider
        ]);
      }

      logger.debug(`Stored ${data.length} market data records`);
    } catch (error) {
      logger.error('Failed to store market data:', error);
      throw error;
    }
  }

  async getLatestData(symbols: string[], limit: number = 100): Promise<MarketData[]> {
    try {
      const query = `
        SELECT symbol, timestamp, open, high, low, close, volume, provider
        FROM market_data
        WHERE symbol = ANY($1)
        ORDER BY timestamp DESC
        LIMIT $2
      `;

      const result = await DatabaseManager.query(query, [symbols, limit]);

      return result.rows.map((row: any) => ({
        symbol: row.symbol,
        timestamp: new Date(row.timestamp),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseInt(row.volume),
        provider: row.provider
      }));
    } catch (error) {
      logger.error('Failed to get latest market data:', error);
      throw error;
    }
  }

  async getHistoricalData(symbol: string, days: number = 30): Promise<MarketData[]> {
    try {
      const query = `
        SELECT symbol, timestamp, open, high, low, close, volume, provider
        FROM market_data
        WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '${days} days'
        ORDER BY timestamp ASC
      `;

      const result = await DatabaseManager.query(query, [symbol]);

      return result.rows.map((row: any) => ({
        symbol: row.symbol,
        timestamp: new Date(row.timestamp),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseInt(row.volume),
        provider: row.provider
      }));
    } catch (error) {
      logger.error(`Failed to get historical data for ${symbol}:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ [key: string]: boolean }> {
    const health: { [key: string]: boolean } = {};

    for (const source of this.sources) {
      health[source.name] = await source.isAvailable();
    }

    return health;
  }
}

export const dataIngestor = new DataIngestor();
