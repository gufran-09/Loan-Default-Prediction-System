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

  // Fetch borrowers with loan parameters, balances, demographics, collateral, and risk scores
  const { data, error } = await supabase
    .from('borrowers')
    .select('loan_type, geography, tenure_months, loan_amount, outstanding_balance, age, marital_status, health_status, income_source, collateral_type, collateral_value, existing_credit_card_debt, existing_auto_loans, existing_personal_loans, risk_scores(bucket, score)')

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
  let totalCollateral = 0
  let sumScore = 0
  let scoreCount = 0
  let criticalCount = 0
  let highCount = 0

  rows.forEach((r: any) => {
    totalLoanVolume += Number(r.loan_amount || 0)
    totalOutstanding += Number(r.outstanding_balance || 0)
    totalCollateral += Number(r.collateral_value || 0)

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

  // Age group bucketing
  const ageBuckets: Record<string, { total: number; totalScore: number }> = {
    'Under 25': { total: 0, totalScore: 0 },
    '25 - 34': { total: 0, totalScore: 0 },
    '35 - 49': { total: 0, totalScore: 0 },
    '50 - 64': { total: 0, totalScore: 0 },
    '65+': { total: 0, totalScore: 0 },
  }

  rows.forEach((r: any) => {
    const age = Number(r.age || 35)
    let bKey = '35 - 49'
    if (age < 25) bKey = 'Under 25'
    else if (age <= 34) bKey = '25 - 34'
    else if (age <= 49) bKey = '35 - 49'
    else if (age <= 64) bKey = '50 - 64'
    else bKey = '65+'

    ageBuckets[bKey].total++
    const scores = Array.isArray(r.risk_scores) ? r.risk_scores : r.risk_scores ? [r.risk_scores] : []
    ageBuckets[bKey].totalScore += Number(scores[0]?.score || 0)
  })

  const byAgeGroup = Object.entries(ageBuckets).map(([name, val]) => ({
    name,
    total: val.total,
    score: val.total > 0 ? Number((val.totalScore / val.total).toFixed(2)) : 0,
  }))

  const byLoanType = group('loan_type', 'loan_purpose')
  const byGeography = group('geography')
  const byTenure = group('tenure_months')
  const byMaritalStatus = group('marital_status')
  const byIncomeSource = group('income_source')
  const byCollateralType = group('collateral_type')
  const byHealthStatus = group('health_status')

  return NextResponse.json({
    data: {
      summary: {
        totalBorrowers: rows.length,
        totalLoanVolume: Math.round(totalLoanVolume),
        totalOutstandingBalance: Math.round(totalOutstanding),
        totalCollateralSecured: Math.round(totalCollateral),
        collateralizationRate: totalLoanVolume > 0 ? Number(((totalCollateral / totalLoanVolume) * 100).toFixed(1)) : 0,
        averageScore: scoreCount > 0 ? Number((sumScore / scoreCount).toFixed(4)) : 0,
        criticalAlerts: criticalCount,
        highRiskBorrowers: highCount,
      },
      byLoanType,
      byGeography,
      byTenure,
      byAgeGroup,
      byMaritalStatus,
      byIncomeSource,
      byCollateralType,
      byHealthStatus,
    },
  })
}
