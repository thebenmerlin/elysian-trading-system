"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.binanceStream = exports.BinanceWebSocketStream = void 0;
const ws_1 = __importDefault(require("ws"));
const logger_1 = require("../../utils/logger");
const database_1 = require("../../utils/database");
const events_1 = require("events");
class BinanceWebSocketStream extends events_1.EventEmitter {
    constructor(symbols = ['btcusdt', 'ethusdt', 'adausdt', 'dotusdt', 'linkusdt']) {
        super();
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.symbols = [];
        this.isConnected = false;
        this.symbols = symbols;
    }
    async start() {
        try {
            const streamUrl = this.buildStreamUrl();
            logger_1.logger.info(`🔌 Connecting to Binance WebSocket: ${streamUrl}`);
            this.ws = new ws_1.default(streamUrl);
            this.setupEventHandlers();
        }
        catch (error) {
            logger_1.logger.error('Failed to start Binance WebSocket:', error);
            throw error;
        }
    }
    buildStreamUrl() {
        const streams = this.symbols.map(symbol => `${symbol.toLowerCase()}@trade`).join('/');
        return `wss://stream.binance.com:9443/ws/${streams}`;
    }
    setupEventHandlers() {
        if (!this.ws)
            return;
        this.ws.on('open', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger_1.logger.info('✅ Binance WebSocket connected');
            this.emit('connected');
        });
        this.ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                await this.handleTradeMessage(message);
            }
            catch (error) {
                logger_1.logger.error('Error processing WebSocket message:', error);
            }
        });
        this.ws.on('close', (code, reason) => {
            this.isConnected = false;
            logger_1.logger.warn(`Binance WebSocket closed: ${code} - ${reason}`);
            this.emit('disconnected', { code, reason });
            this.scheduleReconnect();
        });
        this.ws.on('error', (error) => {
            logger_1.logger.error('Binance WebSocket error:', error);
            this.emit('error', error);
        });
    }
    async handleTradeMessage(message) {
        try {
            if (!message.s || !message.p || !message.q)
                return;
            const tick = {
                symbol: message.s,
                price: parseFloat(message.p),
                quantity: parseFloat(message.q),
                timestamp: message.T,
                isBuyerMaker: message.m
            };
            await this.updateLiveAsset(tick);
            await this.storePriceFeed(tick);
            this.emit('tick', tick);
        }
        catch (error) {
            logger_1.logger.error('Error handling trade message:', error);
        }
    }
    async updateLiveAsset(tick) {
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
            await database_1.DatabaseManager.query(query, [tick.symbol, tick.price, tick.quantity]);
        }
        catch (error) {
            logger_1.logger.error('Failed to update live asset:', error);
        }
    }
    async storePriceFeed(tick) {
        try {
            const query = `
        INSERT INTO price_feeds (symbol, asset_type, timestamp, close, volume, source)
        VALUES ($1, 'crypto', to_timestamp($2/1000), $3, $4, 'binance_ws')
        ON CONFLICT (symbol, timestamp) DO UPDATE SET
          close = EXCLUDED.close,
          volume = COALESCE(price_feeds.volume, 0) + EXCLUDED.volume
      `;
            const minuteTimestamp = Math.floor(tick.timestamp / 60000) * 60000;
            await database_1.DatabaseManager.query(query, [tick.symbol, minuteTimestamp, tick.price, tick.quantity]);
        }
        catch (error) {
            logger_1.logger.error('Failed to store price feed:', error);
        }
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error('Max reconnection attempts reached');
            return;
        }
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        logger_1.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => {
            this.start().catch(error => {
                logger_1.logger.error('Reconnection failed:', error);
            });
        }, delay);
    }
    async stop() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }
    getConnectionStatus() {
        return this.isConnected;
    }
    getSymbols() {
        return this.symbols;
    }
}
exports.BinanceWebSocketStream = BinanceWebSocketStream;
exports.binanceStream = new BinanceWebSocketStream();
