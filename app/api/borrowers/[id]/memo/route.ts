import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCreditUnderwritingMemo } from '@/lib/aws/bedrock'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  return NextResponse.json({ memo })
}
