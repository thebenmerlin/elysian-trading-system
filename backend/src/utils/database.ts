/// <reference types="node" />

import * as process from 'process';
import { Pool } from 'pg';
import { logger } from './logger';

class Database {
  private pool: Pool | null = null;

  async initialize(): Promise<void> {
    if (this.pool) {
      logger.warn('Database already initialized');
      return;
    }

    try {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
      }

      this.pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      logger.info('Database connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      logger.error('Database query failed:', { query: text, params, error });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) return false;
      
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection closed');
    }
  }
}

export const DatabaseManager = new Database();
