import { NextResponse } from 'next/server'
import { generateCreditUnderwritingMemo } from '@/lib/aws/bedrock'
import { getSessionUser } from '@/lib/auth/session'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getSessionUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { borrowerName, loanAmount, monthlyIncome, tenureMonths, score, bucket, riskReasons } = body

  const memo = await generateCreditUnderwritingMemo({
    borrowerName: borrowerName || 'Borrower ' + id.slice(0, 8),
    loanAmount: Number(loanAmount || 25000),
    monthlyIncome: Number(monthlyIncome || 5000),
    tenureMonths: Number(tenureMonths || 36),
    score: Number(score || 500),
    bucket: bucket || 'MEDIUM',
    riskReasons: riskReasons || [],
  })

  // Asynchronously log to Amazon CloudWatch for OCC SR 11-7 compliance
  const { logUnderwriterAudit } = await import('@/lib/aws/cloudwatch')
  logUnderwriterAudit({
    underwriterId: user.id || 'Risk-Officer',
    borrowerId: id,
    action: 'REVIEWED',
    score: Number(score || 500),
    bucket: bucket || 'MEDIUM',
    justification: 'Automated Credit Underwriting Memorandum generated via Amazon Bedrock Claude 3.5',
    metadata: { memoLength: memo.length },
  }).catch(console.warn)

  return NextResponse.json({ memo })
}
