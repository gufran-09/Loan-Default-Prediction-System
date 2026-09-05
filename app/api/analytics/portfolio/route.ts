import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

  // Fetch borrowers with loan parameters, balances, and risk scores
  const { data, error } = await supabase
    .from('borrowers')
    .select('loan_type, geography, tenure_months, loan_amount, outstanding_balance, risk_scores(bucket, score)')


  if (error) {
    console.error('Error fetching portfolio analytics:', error)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Unable to load analytics' } },
      { status: 500 }
    )
  }

  const rows = data || []
  let totalLoanVolume = 0
  let totalOutstanding = 0
  let sumScore = 0
  let scoreCount = 0
  let criticalCount = 0
  let highCount = 0

  rows.forEach((r: any) => {
    totalLoanVolume += Number(r.loan_amount || 0)
    totalOutstanding += Number(r.outstanding_balance || 0)

    const scores = Array.isArray(r.risk_scores) ? r.risk_scores : r.risk_scores ? [r.risk_scores] : []
    const firstScore = scores[0]
    if (firstScore) {
      const scoreVal = Number(firstScore.score || 0)
      sumScore += scoreVal
      scoreCount++
      if (firstScore.bucket === 'critical') criticalCount++
      if (firstScore.bucket === 'high') highCount++
    }
  })

  // Grouping helper
  const group = (key: string, fallbackKey?: string) => {
    const grouped = rows.reduce((acc: any, r: any) => {
      const k = r[key] || (fallbackKey ? r[fallbackKey] : null) || 'Other'
      acc[k] ??= { name: String(k), total: 0, totalScore: 0 }
      acc[k].total++

      const scores = Array.isArray(r.risk_scores) ? r.risk_scores : r.risk_scores ? [r.risk_scores] : []
      const scoreVal = Number(scores[0]?.score || 0)
      acc[k].totalScore += scoreVal
      return acc
    }, {})

    return Object.values(grouped).map((x: any) => ({
      name: x.name,
      total: x.total,
      score: Number((x.totalScore / (x.total || 1)).toFixed(2)),
    }))
  }

  const byLoanType = group('loan_type', 'loan_purpose')
  const byGeography = group('geography')
  const byTenure = group('tenure_months')

  return NextResponse.json({
    data: {
      summary: {
        totalBorrowers: rows.length,
        totalLoanVolume: Math.round(totalLoanVolume),
        totalOutstandingBalance: Math.round(totalOutstanding),
        averageScore: scoreCount > 0 ? Number((sumScore / scoreCount).toFixed(4)) : 0,
        criticalAlerts: criticalCount,
        highRiskBorrowers: highCount,
      },
      byLoanType,
      byGeography,
      byTenure,
    },
  })
}
