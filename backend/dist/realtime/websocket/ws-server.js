"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsServer = exports.ElysianWebSocketServer = void 0;
const ws_1 = require("ws");
const logger_1 = require("../../utils/logger");
const events_1 = require("events");
class ElysianWebSocketServer extends events_1.EventEmitter {
    constructor() {
        super();
        this.wss = null;
        this.clients = new Set();
    }
    initialize(server) {
        this.wss = new ws_1.Server({ server, path: '/ws' });
        this.wss.on('connection', (ws, req) => {
            logger_1.logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });
            this.clients.add(ws);
            this.sendToClient(ws, {
                type: 'connection',
                data: { message: 'Connected to Elysian Trading System' },
                timestamp: Date.now()
            });
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleClientMessage(ws, data);
                }
                catch (error) {
                    logger_1.logger.error('Invalid WebSocket message:', error);
                }
            });
            ws.on('close', () => {
                logger_1.logger.info('WebSocket client disconnected');
                this.clients.delete(ws);
            });
            ws.on('error', (error) => {
                logger_1.logger.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
        logger_1.logger.info('WebSocket server initialized on /ws');
    }
    handleClientMessage(ws, message) {
        switch (message.type) {
            case 'subscribe':
                this.handleSubscribe(ws, message.data);
                break;
            case 'unsubscribe':
                this.handleUnsubscribe(ws, message.data);
                break;
            case 'ping':
                this.sendToClient(ws, {
                    type: 'pong',
                    data: {},
                    timestamp: Date.now()
                });
                break;
            default:
                logger_1.logger.warn('Unknown WebSocket message type:', message.type);
        }
    }
    handleSubscribe(ws, data) {
        if (!ws.subscriptions) {
            ws.subscriptions = new Set();
        }
        if (data.channel) {
            ws.subscriptions.add(data.channel);
            logger_1.logger.info(`Client subscribed to channel: ${data.channel}`);
        }
    }
    handleUnsubscribe(ws, data) {
        if (ws.subscriptions && data.channel) {
            ws.subscriptions.delete(data.channel);
            logger_1.logger.info(`Client unsubscribed from channel: ${data.channel}`);
        }
    }
    broadcastPriceUpdate(symbol, price, assetType) {
        this.broadcast({
            type: 'price_update',
            data: { symbol, price, assetType },
            timestamp: Date.now()
        }, 'prices');
    }
    broadcastTradeExecuted(trade) {
        this.broadcast({
            type: 'trade_executed',
            data: trade,
            timestamp: Date.now()
        }, 'trades');
    }
    broadcastSignalGenerated(signal) {
        this.broadcast({
            type: 'signal_generated',
            data: signal,
            timestamp: Date.now()
        }, 'signals');
    }
    broadcastPortfolioUpdate(portfolio) {
        this.broadcast({
            type: 'portfolio_update',
            data: portfolio,
            timestamp: Date.now()
        }, 'portfolio');
    }
    broadcastSystemEvent(event) {
        this.broadcast({
            type: 'system_event',
            data: event,
            timestamp: Date.now()
        }, 'system');
    }
    broadcast(message, channel) {
        if (!this.wss)
            return;
        const messageStr = JSON.stringify(message);
        let sentCount = 0;
        this.clients.forEach((ws) => {
            if (ws.readyState === ws.OPEN) {
                if (!channel || !ws.subscriptions || ws.subscriptions.has(channel) || ws.subscriptions.has('all')) {
                    try {
                        ws.send(messageStr);
                        sentCount++;
                    }
                    catch (error) {
                        logger_1.logger.error('Error sending WebSocket message:', error);
                        this.clients.delete(ws);
                    }
                }
            }
            else {
                this.clients.delete(ws);
            }
        });
        if (sentCount > 0) {
            logger_1.logger.debug(`Broadcast sent to ${sentCount} clients: ${message.type}`);
        }
    }
    sendToClient(ws, message) {
        if (ws.readyState === ws.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            }
            catch (error) {
                logger_1.logger.error('Error sending WebSocket message to client:', error);
                this.clients.delete(ws);
            }
        }
    }
    getClientCount() {
        return this.clients.size;
    }
    close() {
        if (this.wss) {
            this.wss.close();
            this.clients.clear();
            logger_1.logger.info('WebSocket server closed');
        }
    }
}
exports.ElysianWebSocketServer = ElysianWebSocketServer;
exports.wsServer = new ElysianWebSocketServer();
