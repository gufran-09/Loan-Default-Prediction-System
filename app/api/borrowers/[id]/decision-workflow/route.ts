import { NextResponse } from 'next/server'
import { getScore } from '@/lib/scoring/getScore'
import { startCreditDecisioningWorkflow, getWorkflowExecutionStatus } from '@/lib/aws/stepFunctions'
import { logUnderwriterAudit } from '@/lib/aws/cloudwatch'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: borrowerId } = await params

  if (!borrowerId) {
    return NextResponse.json({ error: { message: 'Borrower ID is required' } }, { status: 400 })
  }

  const scoreData = await getScore(borrowerId)
  if (!scoreData?.borrower) {
    return NextResponse.json({ error: { message: 'Borrower not found' } }, { status: 404 })
  }

  const borrower = scoreData.borrower
  const features = {
    monthly_income: borrower.monthly_income,
    loan_amount: borrower.loan_amount,
    tenure_months: borrower.tenure_months,
    outstanding_balance: borrower.outstanding_balance,
    credit_score: borrower.credit_score || (scoreData ? Number(scoreData.score) : 680),
    interest_rate: borrower.interest_rate || 10.5,
    credit_utilization: borrower.credit_utilization || 0.38,
    delinquency_count_12m: borrower.delinquency_count_12m || 0,
    num_inquiries_6m: borrower.num_inquiries_6m || 1,
    prior_defaults: borrower.prior_defaults || 0,
    collateral_value: borrower.collateral_value || 0,
    months_employed: borrower.months_employed || 24,
  }

  const result = await startCreditDecisioningWorkflow({
    borrower_id: borrowerId,
    features,
  })

  // Log to CloudWatch for regulatory audit
  logUnderwriterAudit({
    underwriterId: 'Risk-Officer',
    borrowerId,
    action: 'REVIEWED',
    score: scoreData.score,
    bucket: scoreData.bucket,
    metadata: {
      stepFunctionsExecutionArn: result.executionArn,
      stpTriggered: true,
    },
  }).catch(console.warn)

  return NextResponse.json({
    data: {
      borrower_id: borrowerId,
      ...result,
      score: scoreData.score,
      bucket: scoreData.bucket,
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const url = new URL(request.url)
  const executionArn = url.searchParams.get('executionArn')

  if (!executionArn) {
    return NextResponse.json({ error: { message: 'executionArn query parameter is required' } }, { status: 400 })
  }

  const status = await getWorkflowExecutionStatus(executionArn)
  return NextResponse.json({ data: status })
}
