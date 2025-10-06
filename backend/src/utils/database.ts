/**
 * Elysian Trading System - Database Manager
 * PostgreSQL connection and query management
 */

import { Pool, PoolClient, QueryResult } from 'pg'
import { logger } from './logger'
import * as fs from 'fs'
import * as path from 'path'

export class DatabaseManager {
  private static pool: Pool | null = null
  private static isInitialized = false

  static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      const databaseUrl = process.env.DATABASE_URL

      if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required')
      }

      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 60000,
        query_timeout: 60000
      })

      // Test connection
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()

      this.isInitialized = true
      logger.info('Database connection initialized successfully')

      // Run migrations if needed
      await this.runMigrationsIfNeeded()

    } catch (error) {
      logger.error('Failed to initialize database:', error)
      throw error
    }
  }

  static async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not initialized')
    }

    const start = Date.now()

    try {
      const result = await this.pool.query(text, params)
      const duration = Date.now() - start

      logger.debug('Database query executed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rows?.length || 0
      })

      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.error('Database query failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  static async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not initialized')
    }
    return await this.pool.connect()
  }

  static async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient()

    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false
      }

      const result = await this.query('SELECT 1 as health_check')
      return result.rows.length > 0
    } catch (error) {
      logger.error('Database health check failed:', error)
      return false
    }
  }

  static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      this.isInitialized = false
      logger.info('Database connection closed')
    }
  }

  private static async runMigrationsIfNeeded(): Promise<void> {
    try {
      // Check if tables exist
      const result = await this.query(`
        SELECT COUNT(*) as table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('system_config', 'market_data', 'signals', 'trades', 'positions')
      `)

      const tableCount = parseInt(result.rows[0].table_count)

      if (tableCount < 5) {
        logger.info('Running database migrations...')

        // Try to read and run migrations file
        const migrationsPath = path.join(process.cwd(), 'db', 'migrations.sql')

        if (fs.existsSync(migrationsPath)) {
          const migrationsSql = fs.readFileSync(migrationsPath, 'utf8')
          await this.query(migrationsSql)
          logger.info('Database migrations completed successfully')
        } else {
          logger.warn('Migrations file not found, skipping automatic migration')
        }
      } else {
        logger.info('Database schema appears to be up to date')
      }

    } catch (error) {
      logger.error('Failed to run migrations:', error)
      // Don't throw here - let the application start even if migrations fail
    }
  }

  // Utility methods for common operations
  static async insertOne(table: string, data: Record<string, any>): Promise<any> {
    const columns = Object.keys(data)
    const values = Object.values(data)
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ')

    const query = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`
    const result = await this.query(query, values)
    return result.rows[0]
  }

  static async updateById(table: string, id: any, data: Record<string, any>): Promise<any> {
    const columns = Object.keys(data)
    const values = Object.values(data)
    const setClause = columns.map((col, index) => `${col} = $${index + 2}`).join(', ')

    const query = `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`
    const result = await this.query(query, [id, ...values])
    return result.rows[0]
  }

  static async findById(table: string, id: any): Promise<any> {
    const result = await this.query(`SELECT * FROM ${table} WHERE id = $1`, [id])
    return result.rows[0] || null
  }

  static async findMany(table: string, conditions: Record<string, any> = {}, limit?: number): Promise<any[]> {
    let query = `SELECT * FROM ${table}`
    const values: any[] = []

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(' AND ')
      query += ` WHERE ${whereClause}`
      values.push(...Object.values(conditions))
    }

    if (limit) {
      query += ` LIMIT ${limit}`
    }

    const result = await this.query(query, values)
    return result.rows
  }

  static async deleteById(table: string, id: any): Promise<boolean> {
    const result = await this.query(`DELETE FROM ${table} WHERE id = $1`, [id])
    return (result.rowCount || 0) > 0
  }
}

export default DatabaseManager
