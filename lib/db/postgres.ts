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
      const host = process.env.RDS_HOST_OVERRIDE || url.hostname
      
      pool = new Pool({
        host,
        port: parseInt(url.port || '5432'),
        user: url.username,
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
        ssl: {
          rejectUnauthorized: false,
          servername: url.hostname,
        },
        max: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
      })
    } catch {
      pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false,
        },
        max: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
      })
    }

    // Prevent process crashes from unhandled errors on idle clients
    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error] Unexpected error on idle client:', err)
    })
  }
  return pool
}

/**
 * Health probe for PostgreSQL connection
 */
export async function checkDbHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const p = getDbPool()
    await p.query('SELECT 1')
    return { status: 'healthy', latencyMs: Date.now() - start }
  } catch (err: any) {
    return { status: 'unhealthy', latencyMs: Date.now() - start, error: err.message }
  }
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
