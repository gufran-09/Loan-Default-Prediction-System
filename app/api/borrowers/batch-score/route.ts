import { NextResponse } from 'next/server'
import { predictXGBoost } from '@/lib/scoring/xgboostPredict'
import { sendCriticalRiskAlert } from '@/lib/aws/sns'
import { logUnderwriterAudit } from '@/lib/aws/cloudwatch'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const applicants = body.applicants

    if (!Array.isArray(applicants) || applicants.length === 0) {
      return NextResponse.json(
        { error: { message: 'Payload must contain a non-empty array of "applicants"' } },
        { status: 400 }
      )
    }

    const maxBatchSize = 100
    const batch = applicants.slice(0, maxBatchSize)
    const results: any[] = []

    for (let i = 0; i < batch.length; i++) {
      const row = batch[i]
      const fullName = row.full_name || row.name || `Applicant ${i + 1}`
      const loanAmount = Number(row.loan_amount || 25000)
      const monthlyIncome = Number(row.monthly_income || 5500)
      const tenureMonths = Number(row.tenure_months || 36)
      const externalId = row.external_id || `LN-B${Date.now().toString().slice(-4)}${i.toString().padStart(2, '0')}`

      const normalizedApplicant = {
        full_name: fullName,
        email: row.email || `${externalId.toLowerCase()}@applicant.institutional.internal`,
        loan_type: row.loan_type || 'Personal',
        loan_amount: loanAmount,
        outstanding_balance: Number(row.outstanding_balance || loanAmount * 0.9),
        geography: row.geography || 'Northeast',
        tenure_months: tenureMonths,
        monthly_income: monthlyIncome,
        employment_status: row.employment_status || 'Full-time',
        credit_score: Number(row.credit_score || 700),
        credit_utilization: Number(row.credit_utilization || 0.35),
        delinquency_count_12m: Number(row.delinquency_count_12m || 0),
        num_inquiries_6m: Number(row.num_inquiries_6m || 1),
        prior_defaults: Number(row.prior_defaults || 0),
        collateral_value: Number(row.collateral_value || 0),
        months_employed: Number(row.months_employed || 36),
        interest_rate: Number(row.interest_rate || 9.5),
      }

      // Execute XGBoost Model Inference
      const prediction = predictXGBoost(normalizedApplicant)

      // Persist to RDS PostgreSQL if active
      let savedBorrowerId = `b_${Date.now()}_${i}`
      if (process.env.DATABASE_URL) {
        try {
          const { queryOne } = await import('@/lib/db/postgres')
          const bRes = await queryOne(
            `INSERT INTO borrowers (
              external_id, full_name, email, loan_type, loan_amount,
              outstanding_balance, geography, tenure_months, monthly_income, employment_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (external_id) DO UPDATE SET full_name = EXCLUDED.full_name
            RETURNING id`,
            [
              externalId,
              normalizedApplicant.full_name,
              normalizedApplicant.email,
              normalizedApplicant.loan_type,
              normalizedApplicant.loan_amount,
              normalizedApplicant.outstanding_balance,
              normalizedApplicant.geography,
              normalizedApplicant.tenure_months,
              normalizedApplicant.monthly_income,
              normalizedApplicant.employment_status,
            ]
          )

          if (bRes?.id) {
            savedBorrowerId = bRes.id
            const sRes = await queryOne(
              `INSERT INTO risk_scores (borrower_id, score, bucket, model_version, scored_at, shap_values, lime_explanation)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING id`,
              [
                savedBorrowerId,
                prediction.score,
                prediction.bucket.toLowerCase(),
                prediction.model_version,
                new Date().toISOString(),
                JSON.stringify(prediction.shap_values),
                JSON.stringify(prediction.lime_explanations),
              ]
            )

            // Auto-create alert if critical or high
            if (prediction.bucket.toLowerCase() === 'critical' || prediction.bucket.toLowerCase() === 'high') {
              await queryOne(
                `INSERT INTO alerts (borrower_id, title, description, severity, status)
                 VALUES ($1, $2, $3, $4, 'open')`,
                [
                  savedBorrowerId,
                  `Elevated Default Risk on Loan ${externalId}`,
                  `Batch ingestion assigned ${prediction.score}/1000 (${prediction.bucket} risk tier).`,
                  prediction.bucket.toLowerCase(),
                ]
              ).catch(() => {})
            }
          }
        } catch (rdsErr) {
          console.warn('[Batch Score] RDS write note:', rdsErr)
        }
      }

      // If critical, trigger SNS alert
      if (prediction.bucket.toLowerCase() === 'critical') {
        sendCriticalRiskAlert({
          borrowerId: savedBorrowerId,
          borrowerName: normalizedApplicant.full_name,
          score: prediction.score,
          bucket: prediction.bucket,
          reasons: prediction.risk_reasons,
        }).catch(console.warn)
      }

      results.push({
        borrower_id: savedBorrowerId,
        external_id: externalId,
        full_name: normalizedApplicant.full_name,
        score: prediction.score,
        bucket: prediction.bucket,
        model_version: prediction.model_version,
      })
    }

    // Log batch event to CloudWatch
    logUnderwriterAudit({
      underwriterId: 'Risk-Officer',
      borrowerId: `batch_${Date.now()}`,
      action: 'RESCORED',
      justification: `Batch applicant ingestion of ${results.length} loans`,
      metadata: { count: results.length },
    }).catch(console.warn)

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
      message: `Successfully evaluated and ingested ${results.length} applicants`,
    })
  } catch (err: any) {
    console.error('Batch score failed:', err)
    return NextResponse.json(
      { error: { message: err?.message || 'Batch scoring failed' } },
      { status: 500 }
    )
  }
}
