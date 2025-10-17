/**
 * Binance WebSocket Real-time Data Stream
 */
import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import { DatabaseManager } from '../../utils/database';
import { EventEmitter } from 'events';

export interface CryptoTick {
  symbol: string;
  price: number;
  quantity: number;
  timestamp: number;
  isBuyerMaker: boolean;
}

export class BinanceWebSocketStream extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private symbols: string[] = [];
  private isConnected = false;

  constructor(symbols: string[] = ['btcusdt', 'ethusdt', 'adausdt', 'dotusdt', 'linkusdt']) {
    super();
    this.symbols = symbols;
  }

  async start(): Promise<void> {
    try {
      const streamUrl = this.buildStreamUrl();
      logger.info(`🔌 Connecting to Binance WebSocket: ${streamUrl}`);
      
      this.ws = new WebSocket(streamUrl);
      this.setupEventHandlers();
    } catch (error) {
      logger.error('Failed to start Binance WebSocket:', error);
      throw error;
    }
  }

  private buildStreamUrl(): string {
    const streams = this.symbols.map(symbol => `${symbol.toLowerCase()}@trade`).join('/');
    return `wss://stream.binance.com:9443/ws/${streams}`;
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('✅ Binance WebSocket connected');
      this.emit('connected');
    });

    this.ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleTradeMessage(message);
      } catch (error) {
        logger.error('Error processing WebSocket message:', error);
      }
    });

    this.ws.on('close', (code: number, reason: string) => {
      this.isConnected = false;
      logger.warn(`Binance WebSocket closed: ${code} - ${reason}`);
      this.emit('disconnected', { code, reason });
      this.scheduleReconnect();
    });

    this.ws.on('error', (error: Error) => {
      logger.error('Binance WebSocket error:', error);
      this.emit('error', error);
    });
  }

  private async handleTradeMessage(message: any): Promise<void> {
    try {
      if (!message.s || !message.p || !message.q) return;

      const tick: CryptoTick = {
        symbol: message.s,
        price: parseFloat(message.p),
        quantity: parseFloat(message.q),
        timestamp: message.T,
        isBuyerMaker: message.m
      };

      // Update live assets table
      await this.updateLiveAsset(tick);
      
      // Store price feed
      await this.storePriceFeed(tick);
      
      // Emit tick for real-time processing
      this.emit('tick', tick);
      
    } catch (error) {
      logger.error('Error handling trade message:', error);
    }
  }

  private async updateLiveAsset(tick: CryptoTick): Promise<void> {
    try {
      const query = `
        INSERT INTO assets_live (symbol, asset_type, price, volume, last_updated, data_source)
        VALUES ($1, 'crypto', $2, $3, NOW(), 'binance_ws')
        ON CONFLICT (symbol, asset_type) 
        DO UPDATE SET 
          price = EXCLUDED.price,
          volume = COALESCE(assets_live.volume, 0) + EXCLUDED.volume,
          last_updated = EXCLUDED.last_updated
      `;
      
      await DatabaseManager.query(query, [tick.symbol, tick.price, tick.quantity]);
    } catch (error) {
      logger.error('Failed to update live asset:', error);
    }
  }

  private async storePriceFeed(tick: CryptoTick): Promise<void> {
    try {
      // Store aggregated minute data
      const query = `
        INSERT INTO price_feeds (symbol, asset_type, timestamp, close, volume, source)
        VALUES ($1, 'crypto', to_timestamp($2/1000), $3, $4, 'binance_ws')
        ON CONFLICT (symbol, timestamp) DO UPDATE SET
          close = EXCLUDED.close,
          volume = COALESCE(price_feeds.volume, 0) + EXCLUDED.volume
      `;
      
      // Round timestamp to minute
      const minuteTimestamp = Math.floor(tick.timestamp / 60000) * 60000;
      await DatabaseManager.query(query, [tick.symbol, minuteTimestamp, tick.price, tick.quantity]);
    } catch (error) {
      logger.error('Failed to store price feed:', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.start().catch(error => {
        logger.error('Reconnection failed:', error);
      });
    }, delay);
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSymbols(): string[] {
    return this.symbols;
  }
}

export const binanceStream = new BinanceWebSocketStream();
