/**
 * WebSocket Server for Real-time Updates
 */
import { Server as WebSocketServer } from 'ws';
import { Server } from 'http';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

export interface WSMessage {
  type: string;
  data: any;
  timestamp: number;
}

export class ElysianWebSocketServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Set<any> = new Set();

  constructor() {
    super();
  }

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    this.wss.on('connection', (ws, req) => {
      logger.info('WebSocket client connected', { ip: req.socket.remoteAddress });
      
      this.clients.add(ws);
      
      // Send welcome message
      this.sendToClient(ws, {
        type: 'connection',
        data: { message: 'Connected to Elysian Trading System' },
        timestamp: Date.now()
      });

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          logger.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error: Error) => {
        logger.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    logger.info('WebSocket server initialized on /ws');
  }

  private handleClientMessage(ws: any, message: any): void {
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
        logger.warn('Unknown WebSocket message type:', message.type);
    }
  }

  private handleSubscribe(ws: any, data: any): void {
    // Store subscription preferences on the WebSocket instance
    if (!ws.subscriptions) {
      ws.subscriptions = new Set();
    }
    
    if (data.channel) {
      ws.subscriptions.add(data.channel);
      logger.info(`Client subscribed to channel: ${data.channel}`);
    }
  }

  private handleUnsubscribe(ws: any, data: any): void {
    if (ws.subscriptions && data.channel) {
      ws.subscriptions.delete(data.channel);
      logger.info(`Client unsubscribed from channel: ${data.channel}`);
    }
  }

  // Broadcast methods
  broadcastPriceUpdate(symbol: string, price: number, assetType: 'crypto' | 'equity'): void {
    this.broadcast({
      type: 'price_update',
      data: { symbol, price, assetType },
      timestamp: Date.now()
    }, 'prices');
  }

  broadcastTradeExecuted(trade: any): void {
    this.broadcast({
      type: 'trade_executed',
      data: trade,
      timestamp: Date.now()
    }, 'trades');
  }

  broadcastSignalGenerated(signal: any): void {
    this.broadcast({
      type: 'signal_generated',
      data: signal,
      timestamp: Date.now()
    }, 'signals');
  }

  broadcastPortfolioUpdate(portfolio: any): void {
    this.broadcast({
      type: 'portfolio_update',
      data: portfolio,
      timestamp: Date.now()
    }, 'portfolio');
  }

  broadcastSystemEvent(event: any): void {
    this.broadcast({
      type: 'system_event',
      data: event,
      timestamp: Date.now()
    }, 'system');
  }

  private broadcast(message: WSMessage, channel?: string): void {
    if (!this.wss) return;

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        // Check if client is subscribed to this channel
        if (!channel || !ws.subscriptions || ws.subscriptions.has(channel) || ws.subscriptions.has('all')) {
          try {
            ws.send(messageStr);
            sentCount++;
          } catch (error) {
            logger.error('Error sending WebSocket message:', error);
            this.clients.delete(ws);
          }
        }
      } else {
        this.clients.delete(ws);
      }
    });

    if (sentCount > 0) {
      logger.debug(`Broadcast sent to ${sentCount} clients: ${message.type}`);
    }
  }

  private sendToClient(ws: any, message: WSMessage): void {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Error sending WebSocket message to client:', error);
        this.clients.delete(ws);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.wss) {
      this.wss.close();
      this.clients.clear();
      logger.info('WebSocket server closed');
    }
  }
}

export const wsServer = new ElysianWebSocketServer();
