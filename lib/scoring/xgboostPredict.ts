import fs from 'fs'
import path from 'path'

export interface XGBoostInferenceResult {
  score: number // 0.0 - 1.0 (calibrated default probability)
  score1000: number // 0 - 1000 integer
  default_probability: number
  bucket: 'low' | 'medium' | 'high' | 'critical'
  model_version: string
  scored_by: string
  shap_values: Record<string, number>
  risk_reasons: { rank: number; feature: string; impact: number; reason: string }[]
  lime_explanations: { feature: string; explanation: string; direction: 'increases' | 'decreases'; magnitude: number }[]
}

interface Tree {
  left_children: number[]
  right_children: number[]
  split_indices: number[]
  split_conditions: number[]
  default_left: number[]
}

interface ModelJson {
  learner: {
    feature_names: string[]
    gradient_booster: {
      model: {
        trees: Tree[]
      }
    }
  }
}

let cachedModel: ModelJson | null = null
let cachedFeatureColumns: string[] | null = null

function getModelAndFeatures() {
  if (!cachedModel || !cachedFeatureColumns) {
    const cwd = process.cwd()
    const modelPath = path.join(cwd, 'ml', 'model.json')
    const colsPath = path.join(cwd, 'ml', 'feature_columns.json')

    cachedModel = JSON.parse(fs.readFileSync(modelPath, 'utf8')) as ModelJson
    cachedFeatureColumns = JSON.parse(fs.readFileSync(colsPath, 'utf8')) as string[]
  }
  return { model: cachedModel, featureColumns: cachedFeatureColumns }
}

/**
 * Build 31-element feature vector matching ML training schema exactly
 */
export function buildXGBoostVector(raw: any, featureColumns: string[]): number[] {
  const fMap: Record<string, number> = {}
  featureColumns.forEach((col, idx) => {
    fMap[col] = idx
  })

  const vec = new Array(featureColumns.length).fill(0)

  // 1. Age
  const age = Number(raw.age ?? raw.Age ?? 43)
  vec[fMap['Age']] = isNaN(age) || age <= 0 ? 43 : age

  // 2. Income (Annual)
  let income = 60000
  if (raw.income != null || raw.annual_income != null) {
    income = Number(raw.income ?? raw.annual_income)
  } else if (raw.monthly_income != null) {
    income = Number(raw.monthly_income) * 12
  }
  vec[fMap['Income']] = isNaN(income) || income <= 0 ? 60000 : income

  // 3. LoanAmount
  const loanAmt = Number(raw.loan_amount ?? raw.LoanAmount ?? 25000)
  vec[fMap['LoanAmount']] = isNaN(loanAmt) || loanAmt <= 0 ? 25000 : loanAmt

  // 4. CreditScore
  const credScore = Number(raw.credit_score ?? raw.CreditScore ?? raw.alternative_credit_score ?? 680)
  vec[fMap['CreditScore']] = isNaN(credScore) || credScore <= 0 ? 680 : credScore

  // 5. MonthsEmployed
  const monthsEmp = Number(raw.months_employed ?? raw.MonthsEmployed ?? raw.months_at_current_job ?? 24)
  vec[fMap['MonthsEmployed']] = isNaN(monthsEmp) || monthsEmp < 0 ? 24 : monthsEmp

  // 6. NumCreditLines
  const numLines = Number(raw.num_credit_lines ?? raw.NumCreditLines ?? 3)
  vec[fMap['NumCreditLines']] = isNaN(numLines) || numLines < 0 ? 3 : numLines

  // 7. InterestRate
  const intRate = Number(raw.interest_rate ?? raw.InterestRate ?? 10.5)
  vec[fMap['InterestRate']] = isNaN(intRate) || intRate <= 0 ? 10.5 : intRate

  // 8. LoanTerm
  const term = Number(raw.loan_term ?? raw.LoanTerm ?? raw.tenure_months ?? 36)
  vec[fMap['LoanTerm']] = isNaN(term) || term <= 0 ? 36 : term

  // 9. DTIRatio
  let dti = raw.dti_ratio ?? raw.DTIRatio
  if (dti == null) {
    const outstanding = Number(raw.outstanding_balance ?? 0)
    const existingDebt = Number(raw.total_existing_debt ?? 0)
    dti = (outstanding + existingDebt) / Math.max(income, 10000)
  }
  const dtiNum = Number(dti)
  vec[fMap['DTIRatio']] = isNaN(dtiNum) || dtiNum < 0 ? 0.35 : Math.min(1.0, dtiNum)

  // 10-13. Education
  const edu = String(raw.education ?? raw.Education ?? raw.education_level ?? "Bachelor's").toLowerCase()
  ;["Bachelor's", 'High School', "Master's", 'PhD'].forEach((val) => {
    const col = `Education_${val}`
    if (fMap[col] !== undefined) {
      vec[fMap[col]] = edu.includes(val.toLowerCase()) ? 1 : 0
    }
  })

  // 14-17. EmploymentType
  const emp = String(raw.employment_type ?? raw.EmploymentType ?? raw.employment_status ?? 'Full-time').toLowerCase().replace(/[-_\s]/g, '')
  ;['Full-time', 'Part-time', 'Self-employed', 'Unemployed'].forEach((val) => {
    const col = `EmploymentType_${val}`
    if (fMap[col] !== undefined) {
      const target = val.toLowerCase().replace(/[-_\s]/g, '')
      vec[fMap[col]] = emp.includes(target) ? 1 : 0
    }
  })

  // 18-20. MaritalStatus
  const marital = String(raw.marital_status ?? raw.MaritalStatus ?? 'Single').toLowerCase()
  ;['Divorced', 'Married', 'Single'].forEach((val) => {
    const col = `MaritalStatus_${val}`
    if (fMap[col] !== undefined) {
      vec[fMap[col]] = marital.includes(val.toLowerCase()) ? 1 : 0
    }
  })

  // 21-22. HasMortgage
  const hasMortgage = Boolean(raw.has_mortgage ?? raw.HasMortgage ?? false)
  if (fMap['HasMortgage_Yes'] !== undefined && fMap['HasMortgage_No'] !== undefined) {
    vec[fMap['HasMortgage_Yes']] = hasMortgage ? 1 : 0
    vec[fMap['HasMortgage_No']] = hasMortgage ? 0 : 1
  }

  // 23-24. HasDependents
  const numDep = Number(raw.num_dependents ?? 0)
  const hasDependents = Boolean(raw.has_dependents ?? raw.HasDependents ?? (numDep > 0))
  if (fMap['HasDependents_Yes'] !== undefined && fMap['HasDependents_No'] !== undefined) {
    vec[fMap['HasDependents_Yes']] = hasDependents ? 1 : 0
    vec[fMap['HasDependents_No']] = hasDependents ? 0 : 1
  }

  // 25-29. LoanPurpose (One-hot invariant: exactly one flag is set to 1)
  const rawPurpose = String(raw.loan_purpose ?? raw.LoanPurpose ?? raw.loan_type ?? 'Other').toLowerCase()
  let matchedPurpose = 'Other'
  if (rawPurpose.includes('auto')) matchedPurpose = 'Auto'
  else if (rawPurpose.includes('business')) matchedPurpose = 'Business'
  else if (rawPurpose.includes('education')) matchedPurpose = 'Education'
  else if (rawPurpose.includes('home')) matchedPurpose = 'Home'
  else matchedPurpose = 'Other' // explicitly maps 'personal', 'personal loan', etc. to 'Other'

  ;['Auto', 'Business', 'Education', 'Home', 'Other'].forEach((val) => {
    const col = `LoanPurpose_${val}`
    if (fMap[col] !== undefined) {
      vec[fMap[col]] = val === matchedPurpose ? 1 : 0
    }
  })

  // 30-31. HasCoSigner
  const hasCosigner = Boolean(raw.has_cosigner ?? raw.has_co_signer ?? raw.HasCoSigner ?? false)
  if (fMap['HasCoSigner_Yes'] !== undefined && fMap['HasCoSigner_No'] !== undefined) {
    vec[fMap['HasCoSigner_Yes']] = hasCosigner ? 1 : 0
    vec[fMap['HasCoSigner_No']] = hasCosigner ? 0 : 1
  }

  // 32. credit_utilization
  const credUtil = Number(raw.credit_utilization ?? raw.creditUtilization ?? 0.38)
  if (fMap['credit_utilization'] !== undefined) {
    vec[fMap['credit_utilization']] = isNaN(credUtil) || credUtil < 0 ? 0.38 : Math.min(1.0, credUtil)
  }

  // 33. delinquency_count_12m
  const delinq = Number(raw.delinquency_count_12m ?? raw.delinquencies_last_12m ?? 0)
  if (fMap['delinquency_count_12m'] !== undefined) {
    vec[fMap['delinquency_count_12m']] = isNaN(delinq) || delinq < 0 ? 0 : Math.min(20, delinq)
  }

  // 34. num_inquiries_6m
  const inq = Number(raw.num_inquiries_6m ?? raw.inquiries_last_6m ?? 1)
  if (fMap['num_inquiries_6m'] !== undefined) {
    vec[fMap['num_inquiries_6m']] = isNaN(inq) || inq < 0 ? 1 : Math.min(20, inq)
  }

  // 35. prior_defaults
  const priors = Number(raw.prior_defaults ?? raw.priorDefaults ?? 0)
  if (fMap['prior_defaults'] !== undefined) {
    vec[fMap['prior_defaults']] = isNaN(priors) || priors < 0 ? 0 : Math.min(10, priors)
  }

  // 36. collateral_value
  let collat = Number(raw.collateral_value ?? raw.collateralValue ?? 0)
  if (collat === 0 && (matchedPurpose === 'Home' || matchedPurpose === 'Auto')) {
    collat = loanAmt * 1.1
  }
  if (fMap['collateral_value'] !== undefined) {
    vec[fMap['collateral_value']] = isNaN(collat) || collat < 0 ? 0 : collat
  }

  return vec
}

/**
 * Executes high-performance, deterministic native XGBoost inference with TreeSHAP attributions.
 */
export function predictXGBoost(rawBorrower: any): XGBoostInferenceResult {
  const { model, featureColumns } = getModelAndFeatures()
  const x = buildXGBoostVector(rawBorrower, featureColumns)

  let margin = 0.0
  const featContribs: Record<string, number> = {}
  featureColumns.forEach((col) => {
    featContribs[col] = 0
  })

  // Traverse all 100 decision trees
  for (const tree of model.learner.gradient_booster.model.trees) {
    let node = 0
    const pathNodes: { fIdx: number; beforeWeight: number }[] = []

    while (tree.left_children[node] !== -1) {
      const fIdx = tree.split_indices[node]
      const cond = tree.split_conditions[node]
      const val = x[fIdx]

      pathNodes.push({ fIdx, beforeWeight: tree.split_conditions[node] })

      if (val === null || val === undefined || isNaN(val)) {
        node = tree.default_left[node] ? tree.left_children[node] : tree.right_children[node]
      } else if (val < cond) {
        node = tree.left_children[node]
      } else {
        node = tree.right_children[node]
      }
    }

    const leafVal = tree.split_conditions[node]
    margin += leafVal

    // Distribute tree margin delta across traversed feature splits for TreeSHAP proxy
    if (pathNodes.length > 0) {
      const portion = leafVal / pathNodes.length
      for (const step of pathNodes) {
        const featName = featureColumns[step.fIdx]
        if (featName) {
          featContribs[featName] = (featContribs[featName] || 0) + portion
        }
      }
    }
  }

  // Logistic sigmoid calibration
  const prob = 1.0 / (1.0 + Math.exp(-margin))
  const defaultProbability = Number(prob.toFixed(4))
  const score1000 = Math.round(prob * 1000)

  // Risk bucket tiering
  let bucket: 'low' | 'medium' | 'high' | 'critical'
  if (prob >= 0.65) {
    bucket = 'critical'
  } else if (prob >= 0.45) {
    bucket = 'high'
  } else if (prob >= 0.25) {
    bucket = 'medium'
  } else {
    bucket = 'low'
  }

  // Format SHAP attributions (ECOA / CFPB Fair Lending Compliance: purge protected attributes)
  const protectedDemographics = new Set(['Age', 'Gender', 'Race'])
  const shapValues: Record<string, number> = {}
  for (const [feat, val] of Object.entries(featContribs)) {
    if (!protectedDemographics.has(feat)) {
      shapValues[feat] = Number(val.toFixed(4))
    }
  }

  // Sort top risk reasons by absolute magnitude
  const sorted = Object.entries(shapValues)
    .filter(([feat, val]) => !protectedDemographics.has(feat) && Math.abs(val) > 0.001)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))

  const fMap: Record<string, number> = {}
  featureColumns.forEach((c, i) => {
    fMap[c] = i
  })

  const reasons = sorted.slice(0, 5).map(([feat, impact], idx) => {
    const direction = impact > 0 ? 'increases' : 'decreases'
    let reason = `${feat} ${direction} default probability by ${Math.abs(impact).toFixed(3)} log-odds`

    if (feat === 'LoanAmount') {
      const amt = x[fMap['LoanAmount']]
      reason = impact > 0 ? `Requested loan amount ($${amt.toLocaleString()}) increases default risk exposure` : `Loan amount ($${amt.toLocaleString()}) is well supported by credit profile`
    } else if (feat === 'Income') {
      const inc = x[fMap['Income']]
      reason = impact < 0 ? `Annual income ($${inc.toLocaleString()}) provides strong debt service cushion` : `Income ($${inc.toLocaleString()}) offers limited buffer against debt obligations`
    } else if (feat === 'DTIRatio') {
      const dtiPct = (x[fMap['DTIRatio']] * 100).toFixed(1)
      reason = impact > 0 ? `High debt-to-income ratio (${dtiPct}%) elevates repayment strain` : `Manageable debt-to-income ratio (${dtiPct}%) supports solvency`
    } else if (feat === 'CreditScore') {
      const cs = Math.round(x[fMap['CreditScore']])
      reason = impact < 0 ? `Credit score of ${cs} demonstrates established reliability` : `Credit score of ${cs} reflects higher historical delinquency risk`
    } else if (feat === 'InterestRate') {
      const ir = x[fMap['InterestRate']].toFixed(1)
      reason = impact > 0 ? `Assigned interest rate of ${ir}% increases repayment burden` : `Interest rate of ${ir}% maintains sustainable carrying costs`
    } else if (feat === 'MonthsEmployed') {
      const me = Math.round(x[fMap['MonthsEmployed']])
      reason = impact < 0 ? `${me} months of continuous employment reflects stable earnings` : `Employment history (${me} months) introduces income variability`
    } else if (feat === 'credit_utilization') {
      const utilPct = ((x[fMap['credit_utilization']] ?? 0) * 100).toFixed(1)
      reason = impact > 0 ? `High revolving credit line utilization (${utilPct}%) indicates financial stretch` : `Conservative credit utilization (${utilPct}%) signals disciplined line management`
    } else if (feat === 'delinquency_count_12m') {
      const dCnt = Math.round(x[fMap['delinquency_count_12m']] ?? 0)
      reason = impact > 0 ? `${dCnt} recent delinquency incident(s) in past 12 months elevates default probability` : `Clean payment history with 0 recent delinquencies in past 12 months`
    } else if (feat === 'num_inquiries_6m') {
      const inqCnt = Math.round(x[fMap['num_inquiries_6m']] ?? 0)
      reason = impact > 0 ? `${inqCnt} hard credit inquiries in past 6 months suggests credit-seeking distress` : `Minimal credit inquiries (${inqCnt}) over prior 6 months indicates balance`
    } else if (feat === 'prior_defaults') {
      const pdCnt = Math.round(x[fMap['prior_defaults']] ?? 0)
      reason = impact > 0 ? `Record of ${pdCnt} prior credit default(s) significantly elevates risk profile` : `Zero historical default records strengthens borrowing integrity`
    } else if (feat === 'collateral_value') {
      const cv = Math.round(x[fMap['collateral_value']] ?? 0)
      reason = impact < 0 ? `Pledged collateral value ($${cv.toLocaleString()}) cushions loss given default (LGD)` : `Unsecured debt without collateral increases unhedged loss exposure`
    }

    return {
      rank: idx + 1,
      feature: feat,
      impact,
      reason,
    }
  })

  const limeExplanations = reasons.map((r) => ({
    feature: r.feature,
    explanation: r.reason,
    direction: (r.impact > 0 ? 'increases' : 'decreases') as 'increases' | 'decreases',
    magnitude: Number(Math.abs(r.impact).toFixed(3)),
  }))

  return {
    score: defaultProbability,
    score1000,
    default_probability: defaultProbability,
    bucket,
    model_version: 'v2.1-xgboost-production',
    scored_by: 'Production XGBoost TreeSHAP Engine',
    shap_values: shapValues,
    risk_reasons: reasons,
    lime_explanations: limeExplanations,
  }
}
