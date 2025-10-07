"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const pg_1 = require("pg");
const logger_1 = require("./logger");
class Database {
    constructor() {
        this.pool = null;
    }
    async initialize() {
        if (this.pool) {
            logger_1.logger.warn('Database already initialized');
            return;
        }
        try {
            const connectionString = process.env.DATABASE_URL;
            if (!connectionString) {
                throw new Error('DATABASE_URL environment variable is not set');
            }
            this.pool = new pg_1.Pool({
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
            logger_1.logger.info('Database connection initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize database:', error);
            throw error;
        }
    }
    async query(text, params) {
        if (!this.pool) {
            throw new Error('Database not initialized');
        }
        try {
            const result = await this.pool.query(text, params);
            return result;
        }
        catch (error) {
            logger_1.logger.error('Database query failed:', { query: text, params, error });
            throw error;
        }
    }
    async healthCheck() {
        try {
            if (!this.pool)
                return false;
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            return true;
        }
        catch (error) {
            logger_1.logger.error('Database health check failed:', error);
            return false;
        }
    }
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            logger_1.logger.info('Database connection closed');
        }
    }
}
exports.DatabaseManager = new Database();
