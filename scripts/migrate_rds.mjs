import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import pg from 'pg'
const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env manually if needed
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not set in .env')
  process.exit(1)
}

const url = new URL(dbUrl)
const isAegisRds = url.hostname.includes('aegis-risk-db')
const pool = new Pool({
  host: isAegisRds ? '3.106.72.65' : url.hostname,
  port: parseInt(url.port || '5432'),
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false, servername: url.hostname },
  connectionTimeoutMillis: 30000,
})

async function runMigrations() {
  const client = await pool.connect()
  try {
    console.log('Connected to Amazon RDS PostgreSQL 16.')

    // Ensure _migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        checksum TEXT
      );
    `)

    // Get applied migrations
    const { rows: appliedRows } = await client.query('SELECT filename FROM _migrations')
    const appliedSet = new Set(appliedRows.map(r => r.filename))

    const migrationsDir = path.resolve(__dirname, 'migrations')
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    console.log(`Found ${files.length} migration file(s). ${appliedSet.size} already applied.`)

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  - Skipping already applied: ${file}`)
        continue
      }

      console.log(`  → Applying migration: ${file}...`)
      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf8')
      const checksum = crypto.createHash('md5').update(sql).digest('hex')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO _migrations (filename, checksum) VALUES ($1, $2)',
          [file, checksum]
        )
        await client.query('COMMIT')
        console.log(`  ✓ Successfully applied: ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`  ✗ FAILED to apply ${file}:`, err)
        process.exit(1)
      }
    }

    console.log('\nAll pending RDS PostgreSQL migrations applied successfully!')
  } finally {
    client.release()
    await pool.end()
  }
}

runMigrations().catch(err => {
  console.error('Migration runner error:', err)
  process.exit(1)
})
