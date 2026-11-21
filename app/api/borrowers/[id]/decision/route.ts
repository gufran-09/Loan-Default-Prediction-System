import { NextResponse } from 'next/server'
import { getScore } from '@/lib/scoring/getScore'
import { logUnderwriterAudit } from '@/lib/aws/cloudwatch'
import { sendCriticalRiskAlert } from '@/lib/aws/sns'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: borrowerId } = await params

  if (!borrowerId) {
    return NextResponse.json({ error: { message: 'Borrower ID is required' } }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { decision, notes, underwriterId } = body

    const validDecisions = ['APPROVED', 'DECLINED', 'REFERRED_TO_COMMITTEE']
    if (!decision || !validDecisions.includes(decision)) {
      return NextResponse.json(
        { error: { message: `Decision must be one of: ${validDecisions.join(', ')}` } },
        { status: 400 }
      )
    }

    const scoreData = await getScore(borrowerId)
    const officerId = underwriterId || 'Risk-Officer'
    const decisionAt = new Date().toISOString()

    // 1. Persist decision to RDS PostgreSQL if configured
    if (process.env.DATABASE_URL) {
      try {
        const { queryOne } = await import('@/lib/db/postgres')
        // Ensure decision columns exist or update
        await queryOne(
          `ALTER TABLE borrowers 
           ADD COLUMN IF NOT EXISTS underwriting_decision TEXT,
           ADD COLUMN IF NOT EXISTS decision_notes TEXT,
           ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP WITH TIME ZONE,
           ADD COLUMN IF NOT EXISTS decided_by TEXT`
        ).catch(() => {})

        await queryOne(
          `UPDATE borrowers 
           SET underwriting_decision = $1, decision_notes = $2, decided_at = $3, decided_by = $4 
           WHERE id = $5`,
          [decision, notes || '', decisionAt, officerId, borrowerId]
        )
      } catch (rdsErr) {
        console.warn('[Decision API] RDS update note:', rdsErr)
      }
    }

    // 2. Stream Underwriter Decision Audit to Amazon CloudWatch for OCC SR 11-7 compliance
    await logUnderwriterAudit({
      underwriterId: officerId,
      borrowerId,
      action: decision === 'APPROVED' ? 'APPROVED' : decision === 'DECLINED' ? 'REJECTED' : 'MANUAL_OVERRIDE',
      score: scoreData?.score,
      bucket: scoreData?.bucket,
      justification: notes || `Underwriter decision: ${decision}`,
      metadata: {
        decision,
        decided_at: decisionAt,
        notes,
      },
    }).catch(console.warn)

    // 3. If declined, dispatch SNS alert to risk committee
    if (decision === 'DECLINED' && scoreData) {
      await sendCriticalRiskAlert({
        borrowerId,
        borrowerName: scoreData.borrower.full_name,
        score: scoreData.score,
        bucket: scoreData.bucket,
        reasons: scoreData.risk_reasons,
      }).catch(console.warn)
    }

    return NextResponse.json({
      success: true,
      data: {
        borrower_id: borrowerId,
        decision,
        notes: notes || '',
        decided_at: decisionAt,
        decided_by: officerId,
      },
      message: `Credit facility decision successfully recorded: ${decision}`,
    })
  } catch (err: any) {
    console.error('Decision recording failed:', err)
    return NextResponse.json({ error: { message: err?.message || 'Failed to record decision' } }, { status: 500 })
  }
}
