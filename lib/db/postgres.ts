import { Pool } from 'pg'

let pool: Pool | null = null

export function getDbPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not defined')
    }

    try {
      const url = new URL(connectionString)
      const isAegisRds = url.hostname.includes('aegis-risk-db')
      pool = new Pool({
        host: isAegisRds ? '3.106.72.65' : url.hostname,
        port: parseInt(url.port || '5432'),
        user: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: {
          rejectUnauthorized: false,
          servername: url.hostname,
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      })
    } catch {
      pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false,
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      })
    }
  }
  return pool
}

/**
 * Execute a query with parameters against AWS RDS PostgreSQL
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const p = getDbPool()
  const res = await p.query(text, params)
  return res.rows as T[]
}

export const queryMany = query

/**
 * Execute a single-row query
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] || null
}
