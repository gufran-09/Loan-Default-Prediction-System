import { Pool } from 'pg'

let pool: Pool | null = null

export function getDbPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not defined')
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
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

/**
 * Execute a single-row query
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] || null
}
