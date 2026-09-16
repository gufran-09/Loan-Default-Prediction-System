import { Borrower } from '../types'

export interface ShapWaterfallBar {
  feature: string
  label: string
  value: number
  start: number
  end: number
  isPositive: boolean
  formattedValue: string
}

export interface LimeCard {
  feature: string
  title: string
  explanation: string
  direction: 'increases' | 'decreases'
  magnitude: number
  impactBadge: string
  category: 'credit' | 'demographic' | 'financial' | 'alternative'
}

/**
 * Friendly labels for internal ML feature names
 */
const FEATURE_LABELS: Record<string, { label: string; category: LimeCard['category'] }> = {
  debt_to_income: { label: 'Debt-to-Income (DTI)', category: 'credit' },
  loan_to_income: { label: 'Loan-to-Income Ratio', category: 'credit' },
  tenure_history: { label: 'Credit History Tenure', category: 'credit' },
  applicant_age: { label: 'Applicant Age Profile', category: 'demographic' },
  dependents_burden: { label: 'Family Dependents', category: 'demographic' },
  health_status: { label: 'Health & Medical Risk', category: 'demographic' },
  marital_status: { label: 'Household Structure', category: 'demographic' },
  collateral_coverage: { label: 'Collateral Cushion', category: 'financial' },
  asset_liquidity: { label: 'Liquid Asset Reserves', category: 'financial' },
  income_stability: { label: 'Income & Job Stability', category: 'financial' },
  alternative_credit: { label: 'Alternative Utility/Rent History', category: 'alternative' },
}

/**
 * Transform SHAP feature attribution dictionary into waterfall steps suitable for charting.
 */
export function generateShapWaterfallData(
  shapValues: Record<string, number> = {},
  baseScore: number = 280
): { bars: ShapWaterfallBar[]; finalScore: number; baseScore: number } {
  const bars: ShapWaterfallBar[] = []
  let running = baseScore

  // Sort by magnitude descending
  const sortedEntries = Object.entries(shapValues).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))

  for (const [feat, rawImpact] of sortedEntries) {
    // Scale impact from logit scale to score points (~85 pts per logit unit)
    const pointImpact = Math.round(rawImpact * 85)
    if (pointImpact === 0) continue

    const start = running
    running = Math.max(10, Math.min(990, running + pointImpact))
    const end = running
    const config = FEATURE_LABELS[feat] || { label: feat.replace(/_/g, ' '), category: 'credit' }

    bars.push({
      feature: feat,
      label: config.label,
      value: pointImpact,
      start,
      end,
      isPositive: pointImpact > 0,
      formattedValue: pointImpact > 0 ? `+${pointImpact} pts` : `${pointImpact} pts`,
    })
  }

  return {
    bars,
    finalScore: running,
    baseScore,
  }
}

/**
 * Generate human-friendly LIME cards explaining reasons for credit decision.
 */
export function generateLimeCards(
  limeExplanations?: { feature: string; explanation: string; direction: 'increases' | 'decreases'; magnitude: number }[],
  shapValues?: Record<string, number>
): LimeCard[] {
  if (limeExplanations && limeExplanations.length > 0) {
    return limeExplanations.map((item) => {
      const meta = FEATURE_LABELS[item.feature] || { label: item.feature.replace(/_/g, ' '), category: 'credit' }
      const isRisk = item.direction === 'increases'
      return {
        feature: item.feature,
        title: meta.label,
        explanation: item.explanation,
        direction: item.direction,
        magnitude: item.magnitude,
        impactBadge: isRisk ? 'Increases Risk' : 'Lowers Risk',
        category: meta.category,
      }
    })
  }

  // Fallback: derive cards from SHAP values if limeExplanations array is not present
  if (shapValues && Object.keys(shapValues).length > 0) {
    return Object.entries(shapValues)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 5)
      .map(([feat, impact]) => {
        const meta = FEATURE_LABELS[feat] || { label: feat.replace(/_/g, ' '), category: 'credit' }
        const isRisk = impact > 0
        return {
          feature: feat,
          title: meta.label,
          explanation: isRisk
            ? `${meta.label} contributes unfavorably to default probability.`
            : `${meta.label} provides positive credit strength reducing default hazard.`,
          direction: isRisk ? 'increases' : 'decreases',
          magnitude: Math.abs(impact),
          impactBadge: isRisk ? 'Increases Risk' : 'Lowers Risk',
          category: meta.category,
        }
      })
  }

  return []
}

/**
 * In-browser / Node fallback local SHAP surrogate calculator
 */
export function computeLocalShapSurrogate(borrower: Borrower): {
  shapValues: Record<string, number>
  limeExplanations: { feature: string; explanation: string; direction: 'increases' | 'decreases'; magnitude: number }[]
} {
  const annualIncome = (borrower.monthly_income || 5000) * 12 + 1e-5
  const totalDebt = (borrower.outstanding_balance || 0) +
    (borrower.existing_credit_card_debt || 0) +
    (borrower.existing_auto_loans || 0) +
    (borrower.existing_personal_loans || 0) +
    (borrower.alimony_obligations || 0)
  const dti = totalDebt / annualIncome
  const lti = (borrower.loan_amount || 20000) / annualIncome

  const shapValues: Record<string, number> = {}

  // DTI
  shapValues['debt_to_income'] = Math.round((dti - 0.35) * 3.5 * 100) / 100
  // LTI
  shapValues['loan_to_income'] = Math.round((lti - 0.30) * 1.8 * 100) / 100
  // Tenure
  const tenure = borrower.tenure_months || 36
  shapValues['tenure_history'] = Math.round(-(tenure - 24) * 0.015 * 100) / 100

  // Demographics
  if (borrower.age) {
    shapValues['applicant_age'] = borrower.age < 24 ? 0.28 : borrower.age <= 55 ? -0.15 : 0.12
  }
  if (borrower.num_dependents != null) {
    shapValues['dependents_burden'] = Math.round(Math.min(0.35, borrower.num_dependents * 0.08) * 100) / 100
  }
  if (borrower.health_status) {
    shapValues['health_status'] = borrower.health_status === 'healthy' ? -0.05 : 0.35
  }
  if (borrower.marital_status) {
    shapValues['marital_status'] = borrower.marital_status === 'married' ? -0.10 : 0.05
  }

  // Collateral & Assets
  const collateralValue = borrower.collateral_value || 0
  const collateralCoverage = collateralValue / (borrower.loan_amount || 20000 + 1e-5)
  if (collateralCoverage > 0.5) {
    shapValues['collateral_coverage'] = -0.35
  } else if (collateralValue > 0) {
    shapValues['collateral_coverage'] = -0.15
  }

  const totalAssets = (borrower.real_estate_value || 0) + (borrower.liquid_savings || 0) + (borrower.investment_portfolio_value || 0)
  if (totalAssets > (borrower.loan_amount || 20000)) {
    shapValues['asset_liquidity'] = -0.25
  }

  // Income stability
  if (borrower.income_verified) {
    shapValues['income_stability'] = -0.20
  }

  // Alternative credit
  if (borrower.alternative_credit_score) {
    shapValues['alternative_credit'] = Math.round(-(borrower.alternative_credit_score - 650) / 250.0 * 0.30 * 100) / 100
  }

  const limeCards = generateLimeCards(undefined, shapValues)
  const limeExplanations = limeCards.map((c) => ({
    feature: c.feature,
    explanation: c.explanation,
    direction: c.direction,
    magnitude: c.magnitude,
  }))

  return { shapValues, limeExplanations }
}
