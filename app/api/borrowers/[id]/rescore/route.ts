import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScore } from '@/lib/scoring/getScore'
import { computeLocalShapSurrogate } from '@/lib/scoring/explainability'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: borrowerId } = await params
  const supabase = await createClient()

  try {
    let requestBody: any = {}
    try {
      requestBody = await request.json()
    } catch {
      // Body is optional
    }

    const scoringMethod = requestBody.method || 'rescore'
    const overrides = requestBody.overrides || {}

    // 1. Fetch current borrower record
    const baseScoreDetail = await getScore(borrowerId)
    if (!baseScoreDetail) {
      return NextResponse.json({ error: { message: 'Borrower not found' } }, { status: 404 })
    }

    // Merge any simulated overrides for What-If scenario
    const mergedBorrower = {
      ...baseScoreDetail.borrower,
      ...overrides,
    }

    // 2. Score via AWS Lambda if configured
    let score = baseScoreDetail.score
    let bucket = baseScoreDetail.bucket
    let reasons = baseScoreDetail.risk_reasons
    let shapValues = baseScoreDetail.shap_values
    let limeExplanations = baseScoreDetail.lime_explanations
    let modelVersion = 'v2.0.0-aws-rescore'

    const awsInferenceUrl = process.env.AWS_INFERENCE_ENDPOINT_URL
    if (awsInferenceUrl) {
      try {
        const totalDebt =
          Number(mergedBorrower.existing_credit_card_debt || 0) +
          Number(mergedBorrower.existing_auto_loans || 0) +
          Number(mergedBorrower.existing_personal_loans || 0) +
          Number(mergedBorrower.alimony_obligations || 0)

        const totalAssets =
          Number(mergedBorrower.real_estate_value || 0) +
          Number(mergedBorrower.liquid_savings || 0) +
          Number(mergedBorrower.investment_portfolio_value || 0)

        const resp = await fetch(awsInferenceUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            borrower_id: borrowerId,
            features: {
              monthly_income: mergedBorrower.monthly_income,
              loan_amount: mergedBorrower.loan_amount,
              tenure_months: mergedBorrower.tenure_months,
              outstanding_balance: mergedBorrower.outstanding_balance,
              age: mergedBorrower.age,
              num_dependents: mergedBorrower.num_dependents,
              health_status: mergedBorrower.health_status,
              marital_status: mergedBorrower.marital_status,
              total_existing_debt: totalDebt,
              collateral_value: mergedBorrower.collateral_value,
              collateral_type: mergedBorrower.collateral_type,
              total_assets: totalAssets,
              income_source: mergedBorrower.income_source,
              income_verified: mergedBorrower.income_verified,
              months_at_current_job: mergedBorrower.months_at_current_job,
              income_consistency_score: mergedBorrower.income_consistency_score,
              alternative_credit_score: mergedBorrower.alternative_credit_score,
            },
          }),
          cache: 'no-store',
        })

        if (resp.ok) {
          const liveData = await resp.json()
          score = Number(liveData.score)
          bucket = liveData.bucket
          modelVersion = liveData.model_version || modelVersion
          reasons = liveData.risk_reasons || reasons
          shapValues = liveData.shap_values || shapValues
          limeExplanations = liveData.lime_explanations || limeExplanations
        }
      } catch (awsErr) {
        console.warn('AWS Lambda rescore failed, using surrogate:', awsErr)
      }
    }

    // Fallback: local surrogate calculation
    if (!shapValues || Object.keys(shapValues).length === 0) {
      const local = computeLocalShapSurrogate(mergedBorrower as any)
      shapValues = local.shapValues
      limeExplanations = local.limeExplanations
    }

    const scoredAt = new Date().toISOString()

    // 3. Persist to scoring_history in RDS & Supabase
    const historyPayload = {
      borrower_id: borrowerId,
      score,
      bucket,
      model_version: modelVersion,
      scoring_method: scoringMethod,
      feature_snapshot: mergedBorrower,
      shap_values: shapValues,
      scored_at: scoredAt,
    }

    // RDS Insert
    if (process.env.DATABASE_URL) {
      try {
        const { queryOne } = await import('@/lib/db/postgres')
        await queryOne(
          `INSERT INTO scoring_history (
            borrower_id, score, bucket, model_version, scoring_method,
            feature_snapshot, shap_values, scored_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id`,
          [
            historyPayload.borrower_id,
            historyPayload.score,
            historyPayload.bucket,
            historyPayload.model_version,
            historyPayload.scoring_method,
            JSON.stringify(historyPayload.feature_snapshot),
            JSON.stringify(historyPayload.shap_values),
            historyPayload.scored_at,
          ]
        )

        // Also update latest risk_scores in RDS
        await queryOne(
          `UPDATE risk_scores
           SET score = $1, bucket = $2, model_version = $3, scored_at = $4,
               shap_values = $5, lime_explanation = $6
           WHERE borrower_id = $7`,
          [
            score,
            bucket,
            modelVersion,
            scoredAt,
            JSON.stringify(shapValues),
            JSON.stringify(limeExplanations),
            borrowerId,
          ]
        )
      } catch (rdsErr) {
        console.warn('[Rescore API] RDS write note:', rdsErr)
      }
    }

    // Supabase Insert & Update
    await supabase.from('scoring_history').insert(historyPayload)

    await supabase
      .from('risk_scores')
      .update({
        score,
        bucket,
        model_version: modelVersion,
        scored_at: scoredAt,
        shap_values: shapValues,
        lime_explanation: limeExplanations,
      })
      .eq('borrower_id', borrowerId)

    return NextResponse.json({
      success: true,
      data: {
        score,
        bucket,
        model_version: modelVersion,
        scored_at: scoredAt,
        risk_reasons: reasons,
        shap_values: shapValues,
        lime_explanations: limeExplanations,
      },
    })
  } catch (err: any) {
    console.error('Rescore failed:', err)
    return NextResponse.json({ error: { message: err.message } }, { status: 500 })
  }
}
