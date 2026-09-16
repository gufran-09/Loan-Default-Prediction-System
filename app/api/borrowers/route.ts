import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
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

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') || 10)))
  const search = (url.searchParams.get('search') || '').trim()
  const bucket = (url.searchParams.get('bucket') || '').trim().toLowerCase()

  // Select borrowers with nested latest risk_scores including demographic and financial features
  let query = supabase
    .from('borrowers')
    .select(
      'id, external_id, full_name, email, loan_type, loan_amount, outstanding_balance, geography, tenure_months, monthly_income, employment_status, age, date_of_birth, health_status, disability_flag, num_dependents, marital_status, existing_credit_card_debt, existing_auto_loans, existing_personal_loans, alimony_obligations, real_estate_value, liquid_savings, investment_portfolio_value, collateral_type, collateral_value, income_source, income_verified, months_at_current_job, income_consistency_score, alternative_credit_score, risk_scores!inner(id, score, bucket, model_version, scored_at)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  // Search by borrower full_name or external_id (e.g. LN-000001)
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,external_id.ilike.%${search}%`)
  }

  // Filter by risk bucket (low, medium, high, critical)
  if (bucket && ['low', 'medium', 'high', 'critical'].includes(bucket)) {
    query = query.eq('risk_scores.bucket', bucket)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    // If the schema was legacy, perform adaptive fallback
    console.error('Error fetching borrowers, trying fallback:', error)
    const fallbackQuery = supabase
      .from('borrowers')
      .select('*, risk_scores!inner(id, score, bucket, model_version, scored_at)', { count: 'exact' })

    const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery.range(from, to)
    if (fallbackError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Unable to load borrowers list' } },
        { status: 500 }
      )
    }

    const standardized = (fallbackData || []).map((b: any) => ({
      id: b.id,
      external_id: b.external_id || b.id.slice(0, 8),
      full_name: b.full_name || b.name || 'Unknown',
      email: b.email,
      loan_type: b.loan_type || b.loan_purpose || 'Standard',
      loan_amount: Number(b.loan_amount || 0),
      outstanding_balance: Number(b.outstanding_balance || 0),
      geography: b.geography || 'Global',
      tenure_months: Number(b.tenure_months || 0),
      monthly_income: Number(b.monthly_income || 0),
      employment_status: b.employment_status || b.employment_type || 'Unknown',
      age: b.age != null ? Number(b.age) : undefined,
      health_status: b.health_status,
      disability_flag: b.disability_flag,
      num_dependents: b.num_dependents != null ? Number(b.num_dependents) : undefined,
      marital_status: b.marital_status,
      existing_credit_card_debt: Number(b.existing_credit_card_debt || 0),
      existing_auto_loans: Number(b.existing_auto_loans || 0),
      existing_personal_loans: Number(b.existing_personal_loans || 0),
      alimony_obligations: Number(b.alimony_obligations || 0),
      real_estate_value: Number(b.real_estate_value || 0),
      liquid_savings: Number(b.liquid_savings || 0),
      investment_portfolio_value: Number(b.investment_portfolio_value || 0),
      collateral_type: b.collateral_type,
      collateral_value: Number(b.collateral_value || 0),
      income_source: b.income_source,
      income_verified: b.income_verified,
      months_at_current_job: Number(b.months_at_current_job || 0),
      income_consistency_score: Number(b.income_consistency_score || 0.5),
      alternative_credit_score: b.alternative_credit_score != null ? Number(b.alternative_credit_score) : undefined,
      risk_scores: b.risk_scores,
    }))

    const total = fallbackCount || 0
    return NextResponse.json({
      data: standardized,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  }

  const total = count || 0
  return NextResponse.json({
    data: data || [],
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}

export async function POST(request: Request) {
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

  try {
    const body = await request.json()
    const external_id = body.external_id || `LN-${Math.floor(100000 + Math.random() * 900000)}`

    const borrowerPayload = {
      external_id,
      full_name: body.full_name,
      email: body.email,
      loan_type: body.loan_type || 'Personal Loan',
      loan_amount: Number(body.loan_amount || 10000),
      outstanding_balance: Number(body.outstanding_balance ?? body.loan_amount ?? 10000),
      geography: body.geography || 'North America',
      tenure_months: Number(body.tenure_months || 36),
      monthly_income: Number(body.monthly_income || 5000),
      employment_status: body.employment_status || 'Employed',
      // Demographics
      age: body.age ? Number(body.age) : null,
      date_of_birth: body.date_of_birth || null,
      health_status: body.health_status || 'healthy',
      disability_flag: Boolean(body.disability_flag),
      num_dependents: Number(body.num_dependents || 0),
      marital_status: body.marital_status || 'single',
      // Financial Profile
      existing_credit_card_debt: Number(body.existing_credit_card_debt || 0),
      existing_auto_loans: Number(body.existing_auto_loans || 0),
      existing_personal_loans: Number(body.existing_personal_loans || 0),
      alimony_obligations: Number(body.alimony_obligations || 0),
      real_estate_value: Number(body.real_estate_value || 0),
      liquid_savings: Number(body.liquid_savings || 0),
      investment_portfolio_value: Number(body.investment_portfolio_value || 0),
      collateral_type: body.collateral_type || 'none',
      collateral_value: Number(body.collateral_value || 0),
      income_source: body.income_source || 'wages',
      income_verified: Boolean(body.income_verified),
      months_at_current_job: Number(body.months_at_current_job || 12),
      income_consistency_score: Number(body.income_consistency_score || 0.75),
      alternative_credit_score: body.alternative_credit_score ? Number(body.alternative_credit_score) : null,
    }

    // Insert borrower into Supabase (and RDS if available)
    let newBorrowerId: string | null = null

    if (process.env.DATABASE_URL) {
      try {
        const { queryOne } = await import('@/lib/db/postgres')
        const rdsResult = await queryOne(
          `INSERT INTO borrowers (
            external_id, full_name, email, loan_type, loan_amount, outstanding_balance,
            geography, tenure_months, monthly_income, employment_status,
            age, date_of_birth, health_status, disability_flag, num_dependents, marital_status,
            existing_credit_card_debt, existing_auto_loans, existing_personal_loans, alimony_obligations,
            real_estate_value, liquid_savings, investment_portfolio_value, collateral_type, collateral_value,
            income_source, income_verified, months_at_current_job, income_consistency_score, alternative_credit_score
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
          RETURNING id`,
          [
            borrowerPayload.external_id, borrowerPayload.full_name, borrowerPayload.email, borrowerPayload.loan_type,
            borrowerPayload.loan_amount, borrowerPayload.outstanding_balance, borrowerPayload.geography,
            borrowerPayload.tenure_months, borrowerPayload.monthly_income, borrowerPayload.employment_status,
            borrowerPayload.age, borrowerPayload.date_of_birth, borrowerPayload.health_status, borrowerPayload.disability_flag,
            borrowerPayload.num_dependents, borrowerPayload.marital_status, borrowerPayload.existing_credit_card_debt,
            borrowerPayload.existing_auto_loans, borrowerPayload.existing_personal_loans, borrowerPayload.alimony_obligations,
            borrowerPayload.real_estate_value, borrowerPayload.liquid_savings, borrowerPayload.investment_portfolio_value,
            borrowerPayload.collateral_type, borrowerPayload.collateral_value, borrowerPayload.income_source,
            borrowerPayload.income_verified, borrowerPayload.months_at_current_job, borrowerPayload.income_consistency_score,
            borrowerPayload.alternative_credit_score
          ]
        )
        if (rdsResult) newBorrowerId = rdsResult.id
      } catch (rdsErr) {
        console.warn('RDS insert error, falling back to Supabase:', rdsErr)
      }
    }

    const { data: sbData, error: sbError } = await supabase
      .from('borrowers')
      .insert({
        ...(newBorrowerId ? { id: newBorrowerId } : {}),
        ...borrowerPayload
      })
      .select()
      .single()

    if (sbError && !newBorrowerId) {
      return NextResponse.json({ error: { code: 'INSERT_FAILED', message: sbError.message } }, { status: 500 })
    }

    const borrowerId = newBorrowerId || sbData?.id

    return NextResponse.json({ data: sbData || { id: borrowerId, ...borrowerPayload } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: { code: 'SERVER_ERROR', message: err.message } }, { status: 500 })
  }
}
