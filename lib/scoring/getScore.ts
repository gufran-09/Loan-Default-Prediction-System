import { createClient } from '../supabase/server'
import { Borrower, RiskBucket, MaritalStatus, IncomeSource, CollateralType } from '../types'
import { predictXGBoost } from './xgboostPredict'

export interface RiskReasonDetail {
  reason: string
  feature: string
  impact: number
  rank: number
}

export interface BorrowerScoreDetail {
  // Score information
  score: number
  bucket: RiskBucket
  model_version: string
  scored_at: string
  risk_reasons: RiskReasonDetail[]
  // TreeSHAP / XAI explainability data
  shap_values?: Record<string, number>
  lime_explanations?: { feature: string; explanation: string; direction: 'increases' | 'decreases'; magnitude: number }[]
  // Associated borrower details
  borrower: {
    id: string
    external_id: string
    full_name: string
    email: string
    loan_type: string
    loan_amount: number
    outstanding_balance: number
    geography: string
    tenure_months: number
    monthly_income: number
    employment_status: string
    age?: number
    date_of_birth?: string
    num_dependents?: number
    marital_status?: MaritalStatus
    existing_credit_card_debt?: number
    existing_auto_loans?: number
    existing_personal_loans?: number
    alimony_obligations?: number
    real_estate_value?: number
    liquid_savings?: number
    investment_portfolio_value?: number
    collateral_type?: CollateralType
    collateral_value?: number
    income_source?: IncomeSource
    months_at_current_job?: number
    income_consistency_score?: number
    alternative_credit_score?: number
    // Core Model Features
    months_employed?: number
    num_credit_lines?: number
    interest_rate?: number
    education?: string
    has_mortgage?: boolean
    has_dependents?: boolean
    has_cosigner?: boolean
    // Dataset v2 Underwriting Predictors
    credit_utilization?: number
    delinquency_count_12m?: number
    num_inquiries_6m?: number
    prior_defaults?: number
  }
}

/**
 * Build the standardized borrower object from a raw database row.
 * Handles both RDS and Supabase row shapes gracefully.
 */
function normalizeBorrower(raw: any) {
  const monthsEmployed = raw.months_employed != null ? Number(raw.months_employed) : raw.months_at_current_job != null ? Number(raw.months_at_current_job) : 24
  const numDependents = raw.num_dependents != null ? Number(raw.num_dependents) : 0
  const hasDependents = raw.has_dependents != null ? Boolean(raw.has_dependents) : numDependents > 0

  return {
    id: raw.id,
    external_id: raw.external_id || raw.id?.slice(0, 8) || '',
    full_name: raw.full_name || raw.name || 'Unknown Borrower',
    email: raw.email || '',
    loan_type: raw.loan_type || raw.loan_purpose || 'Standard',
    loan_amount: Number(raw.loan_amount || 0),
    outstanding_balance: Number(raw.outstanding_balance || 0),
    geography: raw.geography || 'Global',
    tenure_months: Number(raw.tenure_months || 0),
    monthly_income: Number(raw.monthly_income || 0),
    employment_status: raw.employment_status || raw.employment_type || 'Unknown',
    age: raw.age != null ? Number(raw.age) : undefined,
    date_of_birth: raw.date_of_birth || undefined,
    num_dependents: numDependents,
    marital_status: raw.marital_status || undefined,
    existing_credit_card_debt: Number(raw.existing_credit_card_debt || 0),
    existing_auto_loans: Number(raw.existing_auto_loans || 0),
    existing_personal_loans: Number(raw.existing_personal_loans || 0),
    alimony_obligations: Number(raw.alimony_obligations || 0),
    real_estate_value: Number(raw.real_estate_value || 0),
    liquid_savings: Number(raw.liquid_savings || 0),
    investment_portfolio_value: Number(raw.investment_portfolio_value || 0),
    collateral_type: raw.collateral_type || 'none',
    collateral_value: Number(raw.collateral_value || 0),
    income_source: raw.income_source || 'wages',
    months_at_current_job: monthsEmployed,
    income_consistency_score: Number(raw.income_consistency_score || 0.5),
    alternative_credit_score: raw.alternative_credit_score != null ? Number(raw.alternative_credit_score) : undefined,
    months_employed: monthsEmployed,
    num_credit_lines: raw.num_credit_lines != null ? Number(raw.num_credit_lines) : 3,
    interest_rate: raw.interest_rate != null ? Number(raw.interest_rate) : 10.5,
    education: raw.education || raw.education_level || "Bachelor's",
    has_mortgage: raw.has_mortgage != null ? Boolean(raw.has_mortgage) : false,
    has_dependents: hasDependents,
    has_cosigner: raw.has_cosigner != null ? Boolean(raw.has_cosigner) : false,
    // Dataset v2 Predictors
    credit_utilization: raw.credit_utilization != null ? Number(raw.credit_utilization) : 0.38,
    delinquency_count_12m: raw.delinquency_count_12m != null ? Number(raw.delinquency_count_12m) : 0,
    num_inquiries_6m: raw.num_inquiries_6m != null ? Number(raw.num_inquiries_6m) : 1,
    prior_defaults: raw.prior_defaults != null ? Number(raw.prior_defaults) : 0,
  }
}

/**
 * Scoring Seam:
 * Evaluates risk score using real XGBoost model or cached score from RDS/Supabase.
 */
export async function getScore(borrowerId: string): Promise<BorrowerScoreDetail | null> {
  let borrower: any = null

  // 1. Try fetching directly from Amazon RDS PostgreSQL if DATABASE_URL is configured
  if (process.env.DATABASE_URL) {
    try {
      const { queryOne } = await import('@/lib/db/postgres')
      borrower = await queryOne(
        `SELECT * FROM borrowers WHERE id = $1`,
        [borrowerId]
      )
    } catch (rdsErr) {
      console.warn('[AWS RDS Query Note] Falling back to Supabase client:', rdsErr)
    }
  }

  // 2. Fallback to Supabase client if not found in RDS
  if (!borrower) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('borrowers')
        .select('*')
        .eq('id', borrowerId)
        .maybeSingle()
      if (!error && data) {
        borrower = data
      }
    } catch (supaErr) {
      console.warn('[Supabase Borrower Query Note]:', supaErr)
    }
  }

  if (!borrower) {
    console.error('Borrower profile not found in RDS or Supabase:', borrowerId)
    return null
  }

  const normalizedBorrower = normalizeBorrower(borrower)

  // 3. Fetch risk score from RDS or Supabase
  let scoreData: any = null
  let reasons: any[] = []

  // 3a. Check RDS risk_scores
  if (process.env.DATABASE_URL) {
    try {
      const { queryOne, queryMany } = await import('@/lib/db/postgres')
      const rdsScore = await queryOne(
        `SELECT * FROM risk_scores WHERE borrower_id = $1 ORDER BY scored_at DESC LIMIT 1`,
        [borrowerId]
      )
      if (rdsScore) {
        scoreData = rdsScore
        const rdsReasons = await queryMany(
          `SELECT * FROM risk_reasons WHERE risk_score_id = $1 ORDER BY rank ASC`,
          [rdsScore.id]
        )
        reasons = rdsReasons || []
      }
    } catch (rdsErr) {
      console.warn('[RDS Score Query Note]:', rdsErr)
    }
  }

  // 3b. Check Supabase risk_scores fallback
  if (!scoreData) {
    try {
      const supabase = await createClient()
      const { data: sData, error: sErr } = await supabase
        .from('risk_scores')
        .select('*')
        .eq('borrower_id', borrowerId)
        .order('scored_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!sErr && sData) {
        scoreData = sData
        const { data: rData } = await supabase
          .from('risk_reasons')
          .select('*')
          .eq('risk_score_id', scoreData.id)
          .order('rank', { ascending: true })
        reasons = rData || []
      }
    } catch (supaErr) {
      console.warn('[Supabase Score Query Note]:', supaErr)
    }
  }

  // 4. If no score in DB, compute in real-time via XGBoost Inference Engine
  if (!scoreData) {
    const livePrediction = predictXGBoost(normalizedBorrower)
    return {
      score: livePrediction.score,
      bucket: livePrediction.bucket as RiskBucket,
      model_version: livePrediction.model_version,
      scored_at: new Date().toISOString(),
      risk_reasons: livePrediction.risk_reasons,
      shap_values: livePrediction.shap_values,
      lime_explanations: livePrediction.lime_explanations,
      borrower: normalizedBorrower,
    }
  }

  // 5. Enrich stored record with real XGBoost TreeSHAP attributions if missing
  let shapValues = scoreData.shap_values
  let limeExplanations = scoreData.lime_explanation

  if (!shapValues || Object.keys(shapValues).length === 0) {
    const livePrediction = predictXGBoost(normalizedBorrower)
    shapValues = livePrediction.shap_values
    limeExplanations = livePrediction.lime_explanations
  }

  const formattedReasons: RiskReasonDetail[] = reasons.map((r: any, idx: number) => {
    const reasonText = r.reason || r.description || `Impact of ${r.feature || r.feature_name || 'signal'}`
    const featureName = r.feature || r.feature_name || 'unknown_feature'
    let impactValue = Number(r.impact ?? r.impact_magnitude ?? 0)
    if (r.impact_direction === '-') {
      impactValue = -Math.abs(impactValue)
    }

    return {
      reason: reasonText,
      feature: featureName,
      impact: impactValue,
      rank: r.rank ?? idx + 1,
    }
  })

  // Format final score: if DB stored as float (e.g. 0.2317) or int, maintain consistency
  const finalScore = Number(scoreData.score)

  return {
    score: finalScore,
    bucket: (scoreData.bucket?.toLowerCase() || 'medium') as RiskBucket,
    model_version: scoreData.model_version || 'v2.1-xgboost-production',
    scored_at: scoreData.scored_at || new Date().toISOString(),
    risk_reasons: formattedReasons.length > 0 ? formattedReasons : [
      { reason: 'Calibrated credit hazard baseline', feature: 'baseline_risk', impact: 0.15, rank: 1 }
    ],
    shap_values: shapValues,
    lime_explanations: limeExplanations,
    borrower: normalizedBorrower,
  }
}
