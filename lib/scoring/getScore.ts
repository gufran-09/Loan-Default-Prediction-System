import { createClient } from '../supabase/server'
import { Borrower, RiskBucket, HealthStatus, MaritalStatus, IncomeSource, CollateralType } from '../types'

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
  // SHAP/LIME explainability data (Phase 4)
  shap_values?: Record<string, number>
  lime_explanations?: { feature: string; explanation: string; direction: 'increases' | 'decreases'; magnitude: number }[]
  // Associated borrower details (eliminates need for separate profile roundtrip)
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
    // Phase 1: Demographic
    age?: number
    date_of_birth?: string
    health_status?: HealthStatus
    disability_flag?: boolean
    num_dependents?: number
    marital_status?: MaritalStatus
    // Phase 2: Financial
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
    income_verified?: boolean
    months_at_current_job?: number
    income_consistency_score?: number
    // Phase 3: Alternative Credit
    alternative_credit_score?: number
  }
}

// All borrower columns for SELECT queries
const BORROWER_COLUMNS = [
  'id', 'external_id', 'full_name', 'email', 'loan_type', 'loan_amount',
  'outstanding_balance', 'geography', 'tenure_months', 'monthly_income',
  'employment_status',
  // Phase 1: Demographic
  'age', 'date_of_birth', 'health_status', 'disability_flag',
  'num_dependents', 'marital_status',
  // Phase 2: Financial
  'existing_credit_card_debt', 'existing_auto_loans', 'existing_personal_loans',
  'alimony_obligations', 'real_estate_value', 'liquid_savings',
  'investment_portfolio_value', 'collateral_type', 'collateral_value',
  'income_source', 'income_verified', 'months_at_current_job',
  'income_consistency_score',
  // Phase 3: Alternative Credit
  'alternative_credit_score'
].join(', ')

/**
 * Build the standardized borrower object from a raw database row.
 * Handles both RDS and Supabase row shapes gracefully.
 */
function normalizeBorrower(raw: any) {
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
    // Phase 1: Demographic
    age: raw.age != null ? Number(raw.age) : undefined,
    date_of_birth: raw.date_of_birth || undefined,
    health_status: raw.health_status || undefined,
    disability_flag: raw.disability_flag ?? undefined,
    num_dependents: raw.num_dependents != null ? Number(raw.num_dependents) : undefined,
    marital_status: raw.marital_status || undefined,
    // Phase 2: Financial
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
    income_verified: raw.income_verified ?? false,
    months_at_current_job: raw.months_at_current_job != null ? Number(raw.months_at_current_job) : 0,
    income_consistency_score: Number(raw.income_consistency_score || 0.5),
    // Phase 3: Alternative Credit
    alternative_credit_score: raw.alternative_credit_score != null ? Number(raw.alternative_credit_score) : undefined,
  }
}

/**
 * Scoring Seam:
 * Currently: reads pre-computed scores and SHAP risk reasons from Supabase.
 * AWS Phase: invokes live Lambda inference endpoint with all borrower features.
 * Dual-path: RDS (primary) → Supabase (backup).
 */
export async function getScore(borrowerId: string): Promise<BorrowerScoreDetail | null> {
  let borrower: any = null

  // 1. Try fetching directly from Amazon RDS PostgreSQL if DATABASE_URL is configured
  if (process.env.DATABASE_URL) {
    try {
      const { queryOne } = await import('@/lib/db/postgres')
      borrower = await queryOne(
        `SELECT ${BORROWER_COLUMNS} FROM borrowers WHERE id = $1`,
        [borrowerId]
      )
    } catch (rdsErr) {
      console.warn('[AWS RDS Query Note] Falling back to Supabase client:', rdsErr)
    }
  }

  const supabase = await createClient()

  // 2. Fallback to Supabase client if not found in RDS
  if (!borrower) {
    const { data, error } = await supabase
      .from('borrowers')
      .select(BORROWER_COLUMNS)
      .eq('id', borrowerId)
      .single()
    if (!error && data) {
      borrower = data
    }
  }

  if (!borrower) {
    console.error('Borrower profile not found in RDS or Supabase:', borrowerId)
    return null
  }

  const normalizedBorrower = normalizeBorrower(borrower)

  // 3. Check if AWS Live Inference Seam is enabled
  const awsInferenceUrl = process.env.AWS_INFERENCE_ENDPOINT_URL
  if (awsInferenceUrl) {
    try {
      // Send all features to Lambda (including new demographic/financial/alt-credit fields)
      const totalDebt = normalizedBorrower.existing_credit_card_debt +
        normalizedBorrower.existing_auto_loans +
        normalizedBorrower.existing_personal_loans +
        normalizedBorrower.alimony_obligations

      const response = await fetch(awsInferenceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrower_id: normalizedBorrower.id,
          features: {
            monthly_income: normalizedBorrower.monthly_income,
            loan_amount: normalizedBorrower.loan_amount,
            tenure_months: normalizedBorrower.tenure_months,
            outstanding_balance: normalizedBorrower.outstanding_balance,
            // New feature signals
            age: normalizedBorrower.age,
            num_dependents: normalizedBorrower.num_dependents,
            health_status: normalizedBorrower.health_status,
            marital_status: normalizedBorrower.marital_status,
            total_existing_debt: totalDebt,
            collateral_value: normalizedBorrower.collateral_value,
            collateral_type: normalizedBorrower.collateral_type,
            total_assets: normalizedBorrower.real_estate_value + normalizedBorrower.liquid_savings + normalizedBorrower.investment_portfolio_value,
            income_source: normalizedBorrower.income_source,
            income_verified: normalizedBorrower.income_verified,
            months_at_current_job: normalizedBorrower.months_at_current_job,
            income_consistency_score: normalizedBorrower.income_consistency_score,
            alternative_credit_score: normalizedBorrower.alternative_credit_score,
          }
        }),
        cache: 'no-store'
      })

      if (response.ok) {
        const liveResult = await response.json()
        const { shapValues, limeExplanations } = (!liveResult.shap_values)
          ? (await import('./explainability')).computeLocalShapSurrogate(normalizedBorrower)
          : { shapValues: liveResult.shap_values, limeExplanations: liveResult.lime_explanations }

        return {
          score: Number(liveResult.score),
          bucket: (liveResult.bucket?.toLowerCase() || 'medium') as RiskBucket,
          model_version: liveResult.model_version || 'v1.0.0-aws-lambda',
          scored_at: new Date().toISOString(),
          risk_reasons: (liveResult.risk_reasons || []).map((r: any, idx: number) => ({
            reason: r.reason || `Impact of ${r.feature}`,
            feature: r.feature || 'risk_signal',
            impact: Number(r.impact || 0),
            rank: r.rank ?? idx + 1
          })),
          shap_values: liveResult.shap_values || shapValues,
          lime_explanations: liveResult.lime_explanations || limeExplanations,
          borrower: normalizedBorrower,
        }
      }
    } catch (awsErr) {
      console.warn('[AWS Live Scoring Seam] Lambda call failed, falling back to cached DB score:', awsErr)
    }
  }

  // 4. Fetch risk score from Supabase (Local/Cached Fallback)
  const { data: scoreData, error: scoreError } = await supabase
    .from('risk_scores')
    .select('id, score, bucket, model_version, scored_at, shap_values, lime_explanation')
    .eq('borrower_id', borrowerId)
    .order('scored_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (scoreError || !scoreData) {
    console.warn(`No risk score found for borrower ${borrowerId}`, scoreError)
    return null
  }


  // Fetch risk reasons (supports both schema column variants: 'reason' vs 'description', 'feature' vs 'feature_name')
  const { data: reasonsData, error: reasonsError } = await supabase
    .from('risk_reasons')
    .select('*')
    .eq(
      // match on risk_score_id or score_id depending on active schema
      'risk_score_id',
      scoreData.id
    )
    .order('rank', { ascending: true })

  // Fallback check if reasons were mapped using score_id
  let reasons = reasonsData || []
  if (reasons.length === 0 && reasonsError) {
    const fallback = await supabase
      .from('risk_reasons')
      .select('*')
      .eq('score_id', scoreData.id)
    reasons = fallback.data || []
  }

  const formattedReasons: RiskReasonDetail[] = reasons.map((r: any, idx: number) => {
    // Standardize reason string and impact float
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

  return {
    score: Number(scoreData.score),
    bucket: scoreData.bucket as RiskBucket,
    model_version: scoreData.model_version,
    scored_at: scoreData.scored_at,
    risk_reasons: formattedReasons,
    shap_values: scoreData.shap_values || undefined,
    lime_explanations: scoreData.lime_explanation || undefined,
    borrower: normalizedBorrower,
  }
}
