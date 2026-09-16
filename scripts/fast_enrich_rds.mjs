import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
const { Pool } = pg

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  }
}

const url = new URL(process.env.DATABASE_URL)
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

async function fastEnrich() {
  const client = await pool.connect()
  try {
    console.log('Running ultra-fast SQL batch enrichment on Amazon RDS PostgreSQL...')

    await client.query('BEGIN')

    // 1. Batch update all borrowers in one SQL statement
    const updateRes = await client.query(`
      UPDATE borrowers SET
        age = 22 + (abs(hashtext(id::text)) % 48),
        date_of_birth = CURRENT_DATE - ((22 + (abs(hashtext(id::text)) % 48)) * INTERVAL '365 days'),
        health_status = CASE abs(hashtext(id::text)) % 5 WHEN 3 THEN 'chronic_condition' WHEN 4 THEN 'disability' ELSE 'healthy' END,
        disability_flag = (abs(hashtext(id::text)) % 5 = 4),
        num_dependents = abs(hashtext(id::text)) % 4,
        marital_status = CASE abs(hashtext(id::text)) % 5 WHEN 0 THEN 'single' WHEN 1 THEN 'married' WHEN 2 THEN 'married' WHEN 3 THEN 'divorced' ELSE 'widowed' END,
        existing_credit_card_debt = ROUND(COALESCE(monthly_income, 5000) * (0.10 + (abs(hashtext(id::text)) % 30) / 100.0)),
        existing_auto_loans = CASE WHEN abs(hashtext(id::text)) % 2 = 0 THEN ROUND(COALESCE(monthly_income, 5000) * 0.25) ELSE 0 END,
        existing_personal_loans = CASE WHEN abs(hashtext(id::text)) % 3 = 0 THEN ROUND(COALESCE(monthly_income, 5000) * 0.15) ELSE 0 END,
        alimony_obligations = CASE WHEN abs(hashtext(id::text)) % 8 = 0 THEN ROUND(COALESCE(monthly_income, 5000) * 0.12) ELSE 0 END,
        collateral_type = CASE WHEN loan_type ILIKE '%Home%' THEN 'real_estate' WHEN loan_type ILIKE '%Auto%' THEN 'vehicle' WHEN abs(hashtext(id::text)) % 6 = 0 THEN 'securities' ELSE 'none' END,
        collateral_value = CASE WHEN loan_type ILIKE '%Home%' THEN ROUND(loan_amount * 1.35) WHEN loan_type ILIKE '%Auto%' THEN ROUND(loan_amount * 0.85) WHEN abs(hashtext(id::text)) % 6 = 0 THEN ROUND(loan_amount * 0.90) ELSE 0 END,
        real_estate_value = CASE WHEN loan_type ILIKE '%Home%' THEN ROUND(loan_amount * 1.35) WHEN abs(hashtext(id::text)) % 2 = 0 THEN ROUND(COALESCE(monthly_income, 5000) * 45) ELSE 0 END,
        liquid_savings = ROUND(COALESCE(monthly_income, 5000) * (2.0 + (abs(hashtext(id::text)) % 40) / 10.0)),
        investment_portfolio_value = CASE WHEN abs(hashtext(id::text)) % 2 = 0 THEN ROUND(COALESCE(monthly_income, 5000) * (2.5 + (abs(hashtext(id::text)) % 30) / 10.0)) ELSE 0 END,
        income_source = CASE abs(hashtext(id::text)) % 5 WHEN 0 THEN 'wages' WHEN 1 THEN 'wages' WHEN 2 THEN 'self_employment' WHEN 3 THEN 'investments' ELSE 'mixed' END,
        income_verified = (abs(hashtext(id::text)) % 10 != 0),
        months_at_current_job = 6 + (abs(hashtext(id::text)) % 115),
        income_consistency_score = ROUND((0.65 + (abs(hashtext(id::text)) % 30) / 100.0)::numeric, 2),
        alternative_credit_score = 590 + (abs(hashtext(id::text)) % 230);
    `)
    console.log(`Updated ${updateRes.rowCount} borrowers with multi-factor profiles.`)

    // 2. Batch insert alternative credit data
    const altRes = await client.query(`
      INSERT INTO alternative_credit_data (
        borrower_id, data_type, provider_name, months_of_history,
        on_time_payment_rate, average_monthly_amount, last_updated
      )
      SELECT
        b.id,
        CASE abs(hashtext(b.id::text)) % 3
          WHEN 0 THEN 'rent_payment'
          WHEN 1 THEN 'utility_payment'
          ELSE 'telecom_payment'
        END,
        CASE abs(hashtext(b.id::text)) % 3
          WHEN 0 THEN 'Equifax Resident Utility / RealPage'
          WHEN 1 THEN 'National Grid Power & Energy'
          ELSE 'Verizon Telecom Billing'
        END,
        12 + (abs(hashtext(b.id::text)) % 36),
        ROUND((0.85 + (abs(hashtext(b.id::text)) % 15) / 100.0)::numeric, 2),
        ROUND((80 + (abs(hashtext(b.id::text)) % 220))::numeric, 2),
        NOW() - ((abs(hashtext(b.id::text)) % 30) * INTERVAL '1 day')
      FROM borrowers b
      ON CONFLICT DO NOTHING;
    `)
    console.log(`Inserted ${altRes.rowCount} alternative credit records.`)

    // 3. Batch insert scoring history from existing risk scores
    const histRes = await client.query(`
      INSERT INTO scoring_history (
        borrower_id, score, bucket, model_version, scoring_method,
        feature_snapshot, shap_values, scored_at
      )
      SELECT
        rs.borrower_id,
        rs.score,
        rs.bucket,
        COALESCE(rs.model_version, 'v1.0.0-xgb'),
        'batch',
        jsonb_build_object(
          'age', b.age,
          'monthly_income', b.monthly_income,
          'collateral_value', b.collateral_value,
          'tenure_months', b.tenure_months,
          'debt_to_income', ROUND((b.outstanding_balance / GREATEST(b.monthly_income * 12, 1000.0))::numeric, 2)
        ),
        jsonb_build_object(
          'debt_to_income', 0.18,
          'loan_to_income', 0.12,
          'tenure_history', -0.06,
          'collateral_coverage', -0.15
        ),
        COALESCE(rs.scored_at, NOW())
      FROM risk_scores rs
      JOIN borrowers b ON b.id = rs.borrower_id
      ON CONFLICT DO NOTHING;
    `)
    console.log(`Inserted ${histRes.rowCount} initial scoring history records.`)

    await client.query('COMMIT')
    console.log('✓ Fast SQL batch enrichment completed successfully!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Fast enrich error:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

fastEnrich()
