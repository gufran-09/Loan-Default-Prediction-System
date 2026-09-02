import { createClient } from '../supabase/server'
import { Borrower, RiskBucket } from '../types'

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
  }
}

/**
 * Scoring Seam:
 * Currently: reads pre-computed scores and SHAP risk reasons from Supabase.
 * In future AWS/SageMaker phase: this is the ONE unified function that updates
 * to invoke the live inference endpoint without breaking any API or UI consumers.
 */
export async function getScore(borrowerId: string): Promise<BorrowerScoreDetail | null> {
  const supabase = await createClient()

  // Fetch borrower profile
  const { data: borrower, error: borrowerError } = await supabase
    .from('borrowers')
    .select('id, external_id, full_name, email, loan_type, loan_amount, outstanding_balance, geography, tenure_months, monthly_income, employment_status')
    .eq('id', borrowerId)
    .single()

  if (borrowerError || !borrower) {
    console.error('Error fetching borrower profile in scoring seam:', borrowerError)
    return null
  }

  // Fetch risk score
  const { data: scoreData, error: scoreError } = await supabase
    .from('risk_scores')
    .select('id, score, bucket, model_version, scored_at')
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
    borrower: {
      id: borrower.id,
      external_id: borrower.external_id || borrower.id.slice(0, 8),
      full_name: borrower.full_name || borrower.name || 'Unknown Borrower',
      email: borrower.email,
      loan_type: borrower.loan_type || borrower.loan_purpose || 'Standard',
      loan_amount: Number(borrower.loan_amount || 0),
      outstanding_balance: Number(borrower.outstanding_balance || 0),
      geography: borrower.geography || 'Global',
      tenure_months: Number(borrower.tenure_months || 0),
      monthly_income: Number(borrower.monthly_income || 0),
      employment_status: borrower.employment_status || borrower.employment_type || 'Unknown',
    },
  }
}
