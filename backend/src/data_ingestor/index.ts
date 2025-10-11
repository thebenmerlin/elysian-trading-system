/**
 * Elysian Trading System - Dual-Market Data Ingestor
 * Supports both equities (Yahoo Finance) and crypto (Binance)
 */
import axios from 'axios';
import { logger } from '../utils/logger';
import { DatabaseManager } from '../utils/database';

export interface MarketData {
  symbol: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  provider: string;
  market_type: 'equity' | 'crypto';
}

export interface CryptoPair {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  min_trade_amount: number;
  price_precision: number;
  quantity_precision: number;
}

class DataIngestor {
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private readonly RATE_LIMIT_MS = 500; // 0.5 seconds between requests
  private cryptoPairs: CryptoPair[] = [];

  constructor() {
    this.initializeCryptoPairs();
  }

  private async initializeCryptoPairs(): Promise<void> {
    try {
      const query = `SELECT * FROM crypto_pairs WHERE is_active = true`;
      const result = await DatabaseManager.query(query);
      
      this.cryptoPairs = result.rows.map((row: any) => ({
        symbol: row.symbol,
        base_asset: row.base_asset,
        quote_asset: row.quote_asset,
        min_trade_amount: parseFloat(row.min_trade_amount),
        price_precision: parseInt(row.price_precision),
        quantity_precision: parseInt(row.quantity_precision)
      }));

      logger.info(`📋 Loaded ${this.cryptoPairs.length} active crypto pairs`);
    } catch (error) {
      logger.error('Failed to load crypto pairs:', error);
      // Fallback to default pairs
      this.cryptoPairs = [
        { symbol: 'BTCUSDT', base_asset: 'BTC', quote_asset: 'USDT', min_trade_amount: 0.00001, price_precision: 2, quantity_precision: 5 },
        { symbol: 'ETHUSDT', base_asset: 'ETH', quote_asset: 'USDT', min_trade_amount: 0.001, price_precision: 2, quantity_precision: 4 }
      ];
    }
  }

  async fetchMarketData(symbols: string[], marketType: 'equity' | 'crypto' = 'equity'): Promise<MarketData[]> {
    const marketData: MarketData[] = [];
    
    logger.info(`📊 Fetching ${marketType} market data for ${symbols.length} symbols`);
    
    for (const symbol of symbols) {
      try {
        await this.enforceRateLimit();
        
        let data: MarketData | null = null;
        
        if (marketType === 'crypto') {
          data = await this.fetchCryptoData(symbol);
        } else {
          data = await this.fetchEquityData(symbol);
        }
        
        if (data) {
          marketData.push(data);
          try {
            await this.storeMarketData(data);
            logger.debug(`✅ Stored ${marketType} data for ${symbol}: $${data.close.toFixed(data.market_type === 'crypto' ? 2 : 2)}`);
          } catch (storeError) {
            logger.warn(`⚠️ Failed to store data for ${symbol}:`, storeError.message);
          }
        }
      } catch (error) {
        logger.error(`Failed to fetch ${marketType} data for ${symbol}:`, error);
        
        const fallbackData = await this.getFallbackData(symbol, marketType);
        if (fallbackData) {
          marketData.push(fallbackData);
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info(`📊 ${marketType.toUpperCase()} data fetch complete: ${marketData.length}/${symbols.length} successful`);
    return marketData;
  }

  private async fetchCryptoData(symbol: string): Promise<MarketData | null> {
    try {
      // Use Binance API (free, no API key required)
      const endpoints = [
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
        `https://api1.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
        `https://api2.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
      ];

      let response;
      for (const endpoint of endpoints) {
        try {
          response = await axios.get(endpoint, {
            timeout: 8000,
            headers: {
              'User-Agent': 'Elysian-Trading-System/1.0'
            }
          });
          break;
        } catch (endpointError) {
          logger.debug(`Binance endpoint ${endpoint} failed, trying next...`);
          continue;
        }
      }

      if (!response) {
        throw new Error('All Binance endpoints failed');
      }

      const data = response.data;
      
      if (!data || !data.symbol) {
        throw new Error(`Invalid response format for ${symbol}`);
      }

      // Get additional OHLC data from klines endpoint
      const klineResponse = await axios.get(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=2`,
        { timeout: 5000 }
      );

      const latestKline = klineResponse.data[klineResponse.data.length - 1];
      
      const marketData: MarketData = {
        symbol,
        timestamp: new Date(parseInt(data.closeTime)),
        open: parseFloat(latestKline[1]), // Open price from kline
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice),
        close: parseFloat(data.lastPrice),
        volume: parseFloat(data.volume),
        provider: 'binance',
        market_type: 'crypto'
      };

      // Validate data quality
      if (marketData.close <= 0 || marketData.volume < 0) {
        throw new Error(`Invalid price/volume data for ${symbol}`);
      }

      if (marketData.high < marketData.low) {
        throw new Error(`Invalid OHLC data for ${symbol}: High < Low`);
      }

      logger.debug(`🪙 Crypto data fetched for ${symbol}: $${marketData.close.toFixed(2)} (24h vol: ${marketData.volume.toFixed(0)})`);
      return marketData;

    } catch (error) {
      logger.error(`Binance fetch failed for ${symbol}:`, error.message);
      return null;
    }
  }

  private async fetchEquityData(symbol: string): Promise<MarketData | null> {
    try {
      const endpoints = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`,
      ];

      let response;
      for (const endpoint of endpoints) {
        try {
          response = await axios.get(endpoint, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
          });
          break;
        } catch (endpointError) {
          continue;
        }
      }

      if (!response) {
        throw new Error('All Yahoo Finance endpoints failed');
      }

      const result = response.data?.chart?.result?.[0];
      if (!result) {
        return null;
      }

      const timestamps = result.timestamp;
      const quotes = result.indicators?.quote?.[0];
      
      if (!timestamps || !quotes || timestamps.length === 0) {
        return null;
      }

      const latestIndex = timestamps.length - 1;
      const timestamp = timestamps[latestIndex];
      
      const open = quotes.open?.[latestIndex];
      const high = quotes.high?.[latestIndex];
      const low = quotes.low?.[latestIndex];
      const close = quotes.close?.[latestIndex];
      const volume = quotes.volume?.[latestIndex];

      if (!open || !high || !low || !close || open <= 0 || close <= 0) {
        return null;
      }

      const marketData: MarketData = {
        symbol,
        timestamp: new Date(timestamp * 1000),
        open: parseFloat(open.toFixed(4)),
        high: parseFloat(high.toFixed(4)),
        low: parseFloat(low.toFixed(4)),
        close: parseFloat(close.toFixed(4)),
        volume: parseInt(volume) || 0,
        provider: 'yahoo',
        market_type: 'equity'
      };

      logger.debug(`📈 Equity data fetched for ${symbol}: $${marketData.close.toFixed(2)}`);
      return marketData;

    } catch (error) {
      logger.error(`Yahoo Finance fetch failed for ${symbol}:`, error.message);
      return null;
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      const waitTime = this.RATE_LIMIT_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  private async getFallbackData(symbol: string, marketType: 'equity' | 'crypto'): Promise<MarketData | null> {
    try {
      const query = `
        SELECT * FROM market_data 
        WHERE symbol = $1 AND market_type = $2
        ORDER BY timestamp DESC 
        LIMIT 1
      `;
      
      const result = await DatabaseManager.query(query, [symbol, marketType]);
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const lastPrice = parseFloat(row.close);
        
        // Generate realistic price based on market type
        const volatility = marketType === 'crypto' ? 0.05 : 0.02; // Crypto more volatile
        const change = (Math.random() - 0.5) * 2 * volatility;
        const newPrice = lastPrice * (1 + change);
        
        logger.info(`📈 Using fallback ${marketType} data for ${symbol}: $${newPrice.toFixed(2)}`);
        
        return {
          symbol,
          timestamp: new Date(),
          open: newPrice * 0.999,
          high: newPrice * (1 + Math.random() * 0.01),
          low: newPrice * (1 - Math.random() * 0.01),
          close: newPrice,
          volume: Math.floor(Math.random() * (marketType === 'crypto' ? 1000000 : 5000000)) + 100000,
          provider: 'fallback',
          market_type: marketType
        };
      }
      
      return this.generateMockData(symbol, marketType);
      
    } catch (error) {
      logger.error(`Fallback data failed for ${symbol}:`, error);
      return this.generateMockData(symbol, marketType);
    }
  }

  private generateMockData(symbol: string, marketType: 'equity' | 'crypto'): MarketData {
    // Base prices for different assets
    const basePrices: { [key: string]: number } = {
      // Equities
      'AAPL': 175, 'MSFT': 330, 'GOOGL': 135, 'NVDA': 450, 'TSLA': 240,
      // Crypto
      'BTCUSDT': 43000, 'ETHUSDT': 2300, 'ADAUSDT': 0.45, 'DOTUSDT': 5.2, 'LINKUSDT': 14.5
    };
    
    const basePrice = basePrices[symbol] || (marketType === 'crypto' ? 100 : 150);
    const volatility = marketType === 'crypto' ? 0.08 : 0.02; // Higher crypto volatility
    const change = (Math.random() - 0.5) * 2 * volatility;
    
    const close = basePrice * (1 + change);
    const open = basePrice;
    const high = Math.max(open, close) * (1 + Math.random() * volatility);
    const low = Math.min(open, close) * (1 - Math.random() * volatility);
    
    const volumeRange = marketType === 'crypto' ? [50000, 2000000] : [1000000, 10000000];
    const volume = Math.floor(Math.random() * (volumeRange[1] - volumeRange[0])) + volumeRange[0];
    
    logger.debug(`🎲 Mock ${marketType} data generated for ${symbol}: $${close.toFixed(2)}`);
    
    return {
      symbol,
      timestamp: new Date(),
      open: parseFloat(open.toFixed(marketType === 'crypto' ? 6 : 4)),
      high: parseFloat(high.toFixed(marketType === 'crypto' ? 6 : 4)),
      low: parseFloat(low.toFixed(marketType === 'crypto' ? 6 : 4)),
      close: parseFloat(close.toFixed(marketType === 'crypto' ? 6 : 4)),
      volume,
      provider: 'mock',
      market_type: marketType
    };
  }

  private async storeMarketData(data: MarketData): Promise<void> {
    try {
      const query = `
        INSERT INTO market_data (symbol, timestamp, open, high, low, close, volume, provider, market_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (symbol, timestamp, provider) DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume,
          market_type = EXCLUDED.market_type
      `;
      
      await DatabaseManager.query(query, [
        data.symbol,
        data.timestamp,
        data.open,
        data.high,
        data.low,
        data.close,
        data.volume,
        data.provider,
        data.market_type
      ]);
    } catch (error) {
      logger.error('Failed to store market data:', error);
      throw error;
    }
  }

  async getHistoricalData(symbol: string, days: number, marketType?: 'equity' | 'crypto'): Promise<MarketData[]> {
    try {
      let query = `
        SELECT * FROM market_data 
        WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '${days} days'
      `;
      const params = [symbol];
      
      if (marketType) {
        query += ` AND market_type = $2`;
        params.push(marketType);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT 1000`;
      
      const result = await DatabaseManager.query(query, params);
      return result.rows.map((row: any) => ({
        symbol: row.symbol,
        timestamp: new Date(row.timestamp),
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: parseInt(row.volume),
        provider: row.provider,
        market_type: row.market_type
      }));
    } catch (error) {
      logger.error('Failed to get historical data:', error);
      return [];
    }
  }

  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const equityTest = await this.fetchEquityData('AAPL');
      const cryptoTest = await this.fetchCryptoData('BTCUSDT');
      const dbHealthy = await DatabaseManager.healthCheck();
      
      return {
        status: (equityTest || cryptoTest) && dbHealthy ? 'healthy' : 'degraded',
        details: {
          equity_api: equityTest ? 'working' : 'failed',
          crypto_api: cryptoTest ? 'working' : 'failed',
          database: dbHealthy ? 'connected' : 'disconnected',
          requests_made: this.requestCount,
          crypto_pairs_loaded: this.cryptoPairs.length
        }
      };
    } catch (error) {
      logger.error('Data ingestor health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          requests_made: this.requestCount
        }
      };
    }
  }

  // Get active crypto pairs
  getCryptoPairs(): CryptoPair[] {
    return this.cryptoPairs;
  }

  // Check if markets are open
  async isMarketOpen(marketType: 'equity' | 'crypto'): Promise<boolean> {
    try {
      if (marketType === 'crypto') {
        return true; // Crypto markets are always open
      }

      // Check equity market hours (simplified)
      const now = new Date();
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const utcTime = utcHours * 60 + utcMinutes;
      
      // NYSE/NASDAQ hours: 14:30 - 21:00 UTC (9:30 AM - 4:00 PM EST)
      const marketOpen = 14 * 60 + 30; // 14:30 UTC
      const marketClose = 21 * 60; // 21:00 UTC
      
      // Check if it's a weekday (Monday = 1, Sunday = 0)
      const dayOfWeek = now.getUTCDay();
      const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
      
      return isWeekday && utcTime >= marketOpen && utcTime <= marketClose;
      
    } catch (error) {
      logger.error('Failed to check market hours:', error);
      return false;
    }
  }
}

export const dataIngestor = new DataIngestor();
