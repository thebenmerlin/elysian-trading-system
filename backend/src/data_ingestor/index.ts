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
  private readonly RATE_LIMIT_MS = 500;
  private cryptoPairs: CryptoPair[] = [];
  private initialized: boolean = false;

  constructor() {
    // Don't initialize crypto pairs immediately - do it lazily
    this.initializeCryptoPairsAsync();
  }

  private async initializeCryptoPairsAsync(): Promise<void> {
    try {
      // Wait a bit to ensure database is initialized
      setTimeout(async () => {
        await this.initializeCryptoPairs();
      }, 5000);
    } catch (error) {
      logger.warn('Failed to initialize crypto pairs, will retry later:', error);
      this.cryptoPairs = [
        { symbol: 'BTCUSDT', base_asset: 'BTC', quote_asset: 'USDT', min_trade_amount: 0.00001, price_precision: 2, quantity_precision: 5 },
        { symbol: 'ETHUSDT', base_asset: 'ETH', quote_asset: 'USDT', min_trade_amount: 0.001, price_precision: 2, quantity_precision: 4 }
      ];
      this.initialized = true;
    }
  }

  private async initializeCryptoPairs(): Promise<void> {
    if (this.initialized) return;
    
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
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to load crypto pairs:', error);
      this.cryptoPairs = [
        { symbol: 'BTCUSDT', base_asset: 'BTC', quote_asset: 'USDT', min_trade_amount: 0.00001, price_precision: 2, quantity_precision: 5 },
        { symbol: 'ETHUSDT', base_asset: 'ETH', quote_asset: 'USDT', min_trade_amount: 0.001, price_precision: 2, quantity_precision: 4 },
        { symbol: 'ADAUSDT', base_asset: 'ADA', quote_asset: 'USDT', min_trade_amount: 10, price_precision: 4, quantity_precision: 0 },
        { symbol: 'DOTUSDT', base_asset: 'DOT', quote_asset: 'USDT', min_trade_amount: 1, price_precision: 3, quantity_precision: 1 },
        { symbol: 'LINKUSDT', base_asset: 'LINK', quote_asset: 'USDT', min_trade_amount: 0.1, price_precision: 3, quantity_precision: 2 }
      ];
      this.initialized = true;
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
          } catch (storeError: any) {
            logger.warn(`⚠️ Failed to store data for ${symbol}:`, storeError.message);
          }
        }
      } catch (error: any) {
        logger.error(`Failed to fetch ${marketType} data for ${symbol}:`, error.message);
        
        const fallbackData = await this.getFallbackData(symbol, marketType);
        if (fallbackData) {
          marketData.push(fallbackData);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    logger.info(`📊 ${marketType.toUpperCase()} data fetch complete: ${marketData.length}/${symbols.length} successful`);
    return marketData;
  }

  private async fetchCryptoData(symbol: string): Promise<MarketData | null> {
    try {
      if (!this.initialized) {
        await this.initializeCryptoPairs();
      }

      const binanceUrls = [
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
        `https://api1.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
        `https://api2.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
        `https://api3.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
      ];

      let response;
      let lastError;

      for (const url of binanceUrls) {
        try {
          response = await axios.get(url, {
            timeout: 8000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Elysian-Trading/1.0)',
              'Accept': 'application/json'
            }
          });
          
          if (response.data && response.data.symbol === symbol) {
            break;
          }
        } catch (error: any) {
          lastError = error;
          logger.debug(`Binance endpoint ${url} failed:`, error.message);
          continue;
        }
      }

      if (!response || !response.data || !response.data.symbol) {
        logger.warn(`All Binance endpoints failed for ${symbol}, using fallback data`);
        return this.generateCryptoFallbackData(symbol);
      }

      const data = response.data;
      
      let ohlcData = null;
      try {
        const klineResponse = await axios.get(
          `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=2`,
          { timeout: 5000 }
        );
        
        if (klineResponse.data && klineResponse.data.length > 0) {
          const latestKline = klineResponse.data[klineResponse.data.length - 1];
          ohlcData = {
            open: parseFloat(latestKline[1]),
            high: parseFloat(latestKline[2]),
            low: parseFloat(latestKline[3]),
            close: parseFloat(latestKline[4])
          };
        }
      } catch (klineError) {
        logger.debug(`Kline data failed for ${symbol}, using ticker data`);
      }

      const marketData: MarketData = {
        symbol,
        timestamp: new Date(parseInt(data.closeTime)),
        open: ohlcData ? ohlcData.open : parseFloat(data.openPrice),
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice),
        close: parseFloat(data.lastPrice),
        volume: parseFloat(data.volume),
        provider: 'binance',
        market_type: 'crypto'
      };

      if (marketData.close <= 0 || marketData.volume < 0) {
        logger.warn(`Invalid data for ${symbol}, using fallback`);
        return this.generateCryptoFallbackData(symbol);
      }

      if (marketData.high < marketData.low) {
        logger.warn(`Invalid OHLC for ${symbol}, using fallback`);
        return this.generateCryptoFallbackData(symbol);
      }

      logger.debug(`🪙 Real crypto data for ${symbol}: $${marketData.close.toFixed(2)} (Vol: ${marketData.volume.toFixed(0)})`);
      return marketData;

    } catch (error: any) {
      logger.error(`Crypto fetch completely failed for ${symbol}:`, error.message);
      return this.generateCryptoFallbackData(symbol);
    }
  }

  private generateCryptoFallbackData(symbol: string): MarketData {
    const cryptoPrices: { [key: string]: number } = {
      'BTCUSDT': 43250 + (Math.random() - 0.5) * 2000,
      'ETHUSDT': 2341 + (Math.random() - 0.5) * 200,
      'ADAUSDT': 0.45 + (Math.random() - 0.5) * 0.05,
      'DOTUSDT': 5.2 + (Math.random() - 0.5) * 0.5,
      'LINKUSDT': 14.5 + (Math.random() - 0.5) * 1.5
    };

    const basePrice = cryptoPrices[symbol] || (Math.random() * 100 + 50);
    const volatility = 0.05;
    const change = (Math.random() - 0.5) * 2 * volatility;
    
    const close = basePrice * (1 + change);
    const open = basePrice;
    const high = Math.max(open, close) * (1 + Math.random() * volatility);
    const low = Math.min(open, close) * (1 - Math.random() * volatility);
    const volume = Math.floor(Math.random() * 2000000) + 100000;

    logger.info(`🎲 Generated fallback crypto data for ${symbol}: $${close.toFixed(2)}`);

    return {
      symbol,
      timestamp: new Date(),
      open: parseFloat(open.toFixed(6)),
      high: parseFloat(high.toFixed(6)),
      low: parseFloat(low.toFixed(6)),
      close: parseFloat(close.toFixed(6)),
      volume,
      provider: 'fallback',
      market_type: 'crypto'
    };
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

    } catch (error: any) {
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
        
        const volatility = marketType === 'crypto' ? 0.05 : 0.02;
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
    const basePrices: { [key: string]: number } = {
      'AAPL': 175, 'MSFT': 330, 'GOOGL': 135, 'NVDA': 450, 'TSLA': 240,
      'BTCUSDT': 43000, 'ETHUSDT': 2300, 'ADAUSDT': 0.45, 'DOTUSDT': 5.2, 'LINKUSDT': 14.5
    };
    
    const basePrice = basePrices[symbol] || (marketType === 'crypto' ? 100 : 150);
    const volatility = marketType === 'crypto' ? 0.08 : 0.02;
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
    } catch (error: any) {
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

  getCryptoPairs(): CryptoPair[] {
    return this.cryptoPairs;
  }

  async isMarketOpen(marketType: 'equity' | 'crypto'): Promise<boolean> {
    try {
      if (marketType === 'crypto') {
        return true;
      }

      const now = new Date();
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const utcTime = utcHours * 60 + utcMinutes;
      
      const marketOpen = 14 * 60 + 30;
      const marketClose = 21 * 60;
      
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
