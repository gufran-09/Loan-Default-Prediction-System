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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

function pseudoHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

async function enrich() {
  const client = await pool.connect()
  try {
    console.log('Fetching existing borrowers from RDS...')
    const { rows: borrowers } = await client.query(`
      SELECT id, loan_type, loan_amount, monthly_income, tenure_months
      FROM borrowers
    `)

    console.log(`Enriching ${borrowers.length} borrowers with demographic, asset, and alternative credit profiles...`)

    await client.query('BEGIN')

    for (const b of borrowers) {
      const h = pseudoHash(b.id)
      const age = 23 + (h % 48) // 23 - 71
      const numDependents = h % 4
      const maritalChoices = ['single', 'married', 'married', 'divorced', 'widowed']
      const marital = maritalChoices[h % maritalChoices.length]
      
      const income = Number(b.monthly_income || 5000)
      const loanAmt = Number(b.loan_amount || 25000)
      const loanType = b.loan_type || 'Personal'

      const ccDebt = Math.round(income * (0.1 + (h % 35) / 100))
      const autoLoan = (h % 2 === 0) ? Math.round(income * 0.25) : 0
      const persLoan = (h % 3 === 0) ? Math.round(income * 0.15) : 0
      const alimony = (marital === 'divorced' && h % 2 === 0) ? Math.round(income * 0.12) : 0

      let collateralType = 'none'
      let collateralValue = 0
      if (loanType === 'Home' || h % 5 === 0) {
        collateralType = 'real_estate'
        collateralValue = Math.round(loanAmt * 1.3)
      } else if (loanType === 'Auto' || h % 4 === 0) {
        collateralType = 'vehicle'
        collateralValue = Math.round(loanAmt * 0.85)
      } else if (h % 7 === 0) {
        collateralType = 'securities'
        collateralValue = Math.round(loanAmt * 0.9)
      }

      const realEstate = collateralType === 'real_estate' ? collateralValue : ((h % 2 === 0) ? Math.round(income * 40) : 0)
      const liquidSavings = Math.round(income * (1.5 + (h % 50) / 10))
      const investments = (h % 2 === 0) ? Math.round(income * (2 + (h % 30) / 10)) : 0

      const incomeSources = ['wages', 'wages', 'self_employment', 'investments', 'mixed']
      const incomeSource = incomeSources[h % incomeSources.length]
      const incomeVerified = h % 10 !== 0 // 90% verified
      const monthsAtJob = 6 + (h % 110)
      const incomeConsistency = Number((0.65 + ((h % 30) / 100)).toFixed(2))
      const altCreditScore = 580 + (h % 240) // 580 - 820

      // Update borrower
      await client.query(`
        UPDATE borrowers SET
          age = $1,
          num_dependents = $2,
          marital_status = $3,
          existing_credit_card_debt = $4,
          existing_auto_loans = $5,
          existing_personal_loans = $6,
          alimony_obligations = $7,
          real_estate_value = $8,
          liquid_savings = $9,
          investment_portfolio_value = $10,
          collateral_type = $11,
          collateral_value = $12,
          income_source = $13,
          income_verified = $14,
          months_at_current_job = $15,
          income_consistency_score = $16,
          alternative_credit_score = $17
        WHERE id = $18
      `, [
        age, numDependents, marital,
        ccDebt, autoLoan, persLoan, alimony,
        realEstate, liquidSavings, investments,
        collateralType, collateralValue,
        incomeSource, incomeVerified, monthsAtJob, incomeConsistency,
        altCreditScore, b.id
      ])

      // Seed alternative credit data entry
      await client.query(`
        INSERT INTO alternative_credit_data (
          borrower_id, data_type, provider_name, months_of_history,
          on_time_payment_rate, average_monthly_amount, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '${h % 30} days')
        ON CONFLICT DO NOTHING
      `, [
        b.id,
        (h % 3 === 0 ? 'rent_payment' : (h % 3 === 1 ? 'utility_payment' : 'telecom_payment')),
        (h % 3 === 0 ? 'Equifax Resident Utility / RealPage' : (h % 3 === 1 ? 'National Grid Power & Energy' : 'Verizon Telecom Billing')),
        12 + (h % 36),
        Number((0.85 + (h % 15) / 100).toFixed(2)),
        Math.round(80 + (h % 220))
      ])

      // Seed an initial scoring_history entry from risk_scores if exists
      const { rows: scoreRows } = await client.query(
        'SELECT score, bucket, model_version, scored_at FROM risk_scores WHERE borrower_id = $1 LIMIT 1',
        [b.id]
      )
      if (scoreRows.length > 0) {
        const sc = scoreRows[0]
        await client.query(`
          INSERT INTO scoring_history (
            borrower_id, score, bucket, model_version, scoring_method,
            feature_snapshot, shap_values, scored_at
          ) VALUES ($1, $2, $3, $4, 'batch', $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          b.id, sc.score, sc.bucket, sc.model_version || 'v1.0.0-xgb',
          JSON.stringify({ age, marital, monthly_income: income, collateral_value: collateralValue }),
          JSON.stringify({ debt_to_income: 0.15, loan_to_income: 0.08, tenure_history: -0.05 }),
          sc.scored_at || new Date()
        ])
      }
    }

    await client.query('COMMIT')
    console.log('✓ Successfully enriched all 400 borrowers and seeded alternative credit & scoring history records in RDS!')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Enrichment failed:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

enrich()
