export type RiskBucket = 'low' | 'medium' | 'high' | 'critical'

export type HealthStatus = 'healthy' | 'chronic_condition' | 'disability'
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed'
export type IncomeSource = 'wages' | 'self_employment' | 'investments' | 'rental' | 'pension' | 'mixed'
export type CollateralType = 'none' | 'real_estate' | 'vehicle' | 'securities' | 'other'

export type Borrower = {
  id: string
  external_id: string
  full_name: string
  email: string
  loan_type: string
  loan_amount: number
  outstanding_balance: number
  geography: string
  tenure_months: number
  monthly_income: number
  employment_status: string
  // Phase 1: Demographic & Personal Data
  age?: number
  date_of_birth?: string
  health_status?: HealthStatus
  disability_flag?: boolean
  num_dependents?: number
  marital_status?: MaritalStatus
  // Phase 2: Financial & Credit Profile
  existing_credit_card_debt?: number
  existing_auto_loans?: number
  existing_personal_loans?: number
  alimony_obligations?: number
  real_estate_value?: number
  liquid_savings?: number
  investment_portfolio_value?: number
  collateral_type?: CollateralType
  collateral_value?: number
  income_source?: IncomeSource
  income_verified?: boolean
  months_at_current_job?: number
  income_consistency_score?: number
  // Phase 3: Alternative Credit
  alternative_credit_score?: number
}

export type RiskScore = {
  score: number
  bucket: RiskBucket
  model_version: string
  scored_at: string
  reasons: { reason: string; feature: string; impact: number; rank: number }[]
}

export type Alert = {
  id: string
  borrower_id: string
  title: string
  description: string
  severity: 'high' | 'medium' | 'low' | 'critical'
  status: 'open' | 'acknowledged' | 'resolved'
  created_at: string
  borrower?: { full_name: string; external_id: string }
}

export type AlternativeCreditData = {
  id: string
  borrower_id: string
  data_type: 'utility_payment' | 'rent_payment' | 'telecom_payment' | 'micro_transaction'
  provider_name: string
  months_of_history: number
  on_time_payment_rate: number
  average_monthly_amount: number
  last_updated: string
}

export type SessionTelemetry = {
  id: string
  session_id: string
  borrower_id?: string
  form_start_time: string
  form_submit_time: string
  total_fill_duration_seconds: number
  field_revision_count: number
  copy_paste_detected: boolean
  inconsistency_flags: string[]
  device_fingerprint?: string
  ip_geo_location?: string
  created_at: string
}

export type ScoringHistoryEntry = {
  id: string
  borrower_id: string
  score: number
  bucket: string
  model_version: string
  scoring_method: 'batch' | 'realtime' | 'rescore' | 'what_if'
  feature_snapshot?: Record<string, any>
  shap_values?: Record<string, number>
  scored_at: string
}
