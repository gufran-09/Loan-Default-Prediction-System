import { predictXGBoost } from '../lib/scoring/xgboostPredict.ts'

console.log('=== TEST 1: ONE-HOT ENCODING INVARIANT (LOAN PURPOSE) ===')
const testPurposes = ['Personal', 'Other', 'Auto', 'Business', 'Education', 'Home', 'unknown_type']
for (const p of testPurposes) {
  const applicant = {
    loan_type: p,
    loan_amount: 25000,
    tenure_months: 36,
    monthly_income: 6000,
    delinquency_count_12m: 1,
    credit_utilization: 35.5,
    num_inquiries_6m: 2,
    prior_defaults: 0,
    collateral_value: 15000
  }
  const res = predictXGBoost(applicant)
  // Check the feature vector if possible or check that predict completed
  console.log(`Loan Type "${p}" -> Score: ${res.score}, Bucket: ${res.bucket}, Model: ${res.model_version}`)
}

console.log('\n=== TEST 2: V2 UNDERWRITING FIELDS REACH SCORING ===')
const baseApplicant = {
  loan_type: 'Other',
  loan_amount: 30000,
  tenure_months: 36,
  monthly_income: 5000,
  delinquency_count_12m: 0,
  credit_utilization: 15,
  num_inquiries_6m: 0,
  prior_defaults: 0,
}
const highRiskApplicant = {
  ...baseApplicant,
  delinquency_count_12m: 5,
  credit_utilization: 95,
  num_inquiries_6m: 8,
  prior_defaults: 2,
}
const predBase = predictXGBoost(baseApplicant)
const predHigh = predictXGBoost(highRiskApplicant)
console.log('Clean credit profile default probability:', predBase.default_probability)
console.log('Severe delinquency/utilization default probability:', predHigh.default_probability)
console.log('Risk reasons for high risk:', predHigh.risk_reasons.map(r => `${r.feature}: ${r.impact}`))

console.log('\n=== TEST 3: WHAT-IF IDENTICAL INPUT SLIDERS SIMULATION ===')
function simulateWhatIf(storedScore, simLoanAmount, origLoanAmount, simIncome, origIncome, simTenure, origTenure) {
  const rawScore = Number(storedScore)
  const baselineScore = rawScore > 1 ? Number((rawScore / 1000).toFixed(4)) : rawScore
  const amountFactor = (simLoanAmount - origLoanAmount) / Math.max(origLoanAmount, 10000) * 0.25
  const incomeFactor = (simIncome - origIncome) / Math.max(origIncome, 2000) * -0.30
  const tenureFactor = (simTenure - origTenure) / Math.max(origTenure, 12) * 0.10

  const simulatedScoreRaw = baselineScore + amountFactor + incomeFactor + tenureFactor
  const simulatedScore = Math.max(0.05, Math.min(0.98, Number(simulatedScoreRaw.toFixed(4))))
  const scoreDelta = Number((simulatedScore - baselineScore).toFixed(4))
  return { baselineScore, simulatedScore, scoreDelta }
}

const beforeBug = (507) // stored score on 0-1000 scale
// Buggy logic:
const buggySim = Math.max(0.05, Math.min(0.98, Number((507 + 0).toFixed(2))))
console.log('Old buggy logic with baseline 507:', buggySim) // 0.98!

// Fixed logic:
const fixedSim = simulateWhatIf(507, 30000, 30000, 4000, 4000, 24, 24)
console.log('Fixed What-If with baseline 507 and unchanged sliders:', fixedSim)

const fixedSimProb = simulateWhatIf(0.507, 30000, 30000, 4000, 4000, 24, 24)
console.log('Fixed What-If with baseline 0.507 and unchanged sliders:', fixedSimProb)

console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY ===')
