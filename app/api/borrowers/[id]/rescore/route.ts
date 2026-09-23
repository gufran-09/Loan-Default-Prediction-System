import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScore } from '@/lib/scoring/getScore'
import { predictXGBoost } from '@/lib/scoring/xgboostPredict'
import { rescoreRequestSchema } from '@/lib/validation/schemas'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: borrowerId } = await params
  const supabase = await createClient()

  try {
    let rawBody: any = {}
    try {
      rawBody = await request.json()
    } catch {
      // Body is optional
    }

    const parseResult = rescoreRequestSchema.safeParse(rawBody)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { message: 'Invalid rescore payload', details: parseResult.error.format() } },
        { status: 400 }
      )
    }

    const { method: scoringMethod, overrides } = parseResult.data

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

    // 2. Perform Real XGBoost Model Inference (100 Trees + TreeSHAP Attributions)
    const prediction = predictXGBoost(mergedBorrower)

    const score = prediction.score
    const bucket = prediction.bucket
    const reasons = prediction.risk_reasons
    const shapValues = prediction.shap_values
    const limeExplanations = prediction.lime_explanations
    const modelVersion = prediction.model_version
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

        // Also update latest risk_scores in RDS (or insert if not present)
        const updateRes = await queryOne(
          `UPDATE risk_scores
           SET score = $1, bucket = $2, model_version = $3, scored_at = $4,
               shap_values = $5, lime_explanation = $6
           WHERE borrower_id = $7
           RETURNING id`,
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

        if (!updateRes) {
          await queryOne(
            `INSERT INTO risk_scores (borrower_id, score, bucket, model_version, scored_at, shap_values, lime_explanation)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              borrowerId,
              score,
              bucket,
              modelVersion,
              scoredAt,
              JSON.stringify(shapValues),
              JSON.stringify(limeExplanations),
            ]
          )
        }
      } catch (rdsErr) {
        console.warn('[Rescore API] RDS write note:', rdsErr)
      }
    }

    // Supabase Insert & Update
    try {
      await supabase.from('scoring_history').insert(historyPayload)

      const { data: updateData } = await supabase
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
        .select('id')

      if (!updateData || updateData.length === 0) {
        await supabase.from('risk_scores').insert({
          borrower_id: borrowerId,
          score,
          bucket,
          model_version: modelVersion,
          scored_at: scoredAt,
          shap_values: shapValues,
          lime_explanation: limeExplanations,
        })
      }
    } catch (supaErr) {
      console.warn('[Rescore API] Supabase write note:', supaErr)
    }

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
