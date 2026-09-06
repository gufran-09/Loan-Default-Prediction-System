import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScore } from '@/lib/scoring/getScore'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Borrower ID is required' } },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const scoreData = await getScore(id)

  if (!scoreData) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Borrower risk assessment not found' } },
      { status: 404 }
    )
  }

  // Asynchronously log access to Amazon CloudWatch for OCC SR 11-7 compliance
  const { logUnderwriterAudit } = await import('@/lib/aws/cloudwatch')
  logUnderwriterAudit({
    underwriterId: user.id,
    borrowerId: id,
    action: 'REVIEWED',
    score: scoreData.score,
    bucket: scoreData.bucket,
  }).catch((cwErr) => console.warn('[CloudWatch Log Notice]:', cwErr))

  // If borrower falls into CRITICAL risk bucket, trigger Amazon SNS underwriter alert
  if (String(scoreData.bucket).toLowerCase() === 'critical') {
    const { sendCriticalRiskAlert } = await import('@/lib/aws/sns')

    sendCriticalRiskAlert({
      borrowerId: id,
      borrowerName: scoreData.borrower.full_name,
      score: scoreData.score,
      bucket: scoreData.bucket,
      reasons: scoreData.risk_reasons,
    }).catch((snsErr) => console.warn('[SNS Alert Notice]:', snsErr))
  }


  return NextResponse.json({ data: scoreData })
}


