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
  const offset = (page - 1) * pageSize

  // 1. Primary Data Source: Amazon RDS PostgreSQL (400 calibrated loan borrowers)
  if (process.env.DATABASE_URL) {
    try {
      const { queryMany, queryOne } = await import('@/lib/db/postgres')

      let whereConditions: string[] = []
      let params: any[] = []
      let paramIdx = 1

      if (search) {
        whereConditions.push(`(b.full_name ILIKE $${paramIdx} OR b.external_id ILIKE $${paramIdx})`)
        params.push(`%${search}%`)
        paramIdx++
      }

      if (bucket && ['low', 'medium', 'high', 'critical'].includes(bucket)) {
        whereConditions.push(`LOWER(r.bucket) = $${paramIdx}`)
        params.push(bucket)
        paramIdx++
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

      const countSql = `
        SELECT count(*) as total
        FROM borrowers b
        LEFT JOIN (
          SELECT DISTINCT ON (borrower_id) borrower_id, bucket
          FROM risk_scores
          ORDER BY borrower_id, scored_at DESC
        ) r ON b.id = r.borrower_id
        ${whereClause}
      `
      const countRes = await queryOne<{ total: string }>(countSql, params)
      const total = countRes ? parseInt(countRes.total, 10) : 0

      const dataSql = `
        SELECT b.id, b.external_id, b.full_name, b.email, b.loan_type, b.loan_amount,
               b.outstanding_balance, b.geography, b.tenure_months, b.monthly_income,
               b.employment_status, b.age, b.date_of_birth, b.num_dependents, b.marital_status,
               b.existing_credit_card_debt, b.existing_auto_loans, b.existing_personal_loans,
               b.alimony_obligations, b.real_estate_value, b.liquid_savings,
               b.investment_portfolio_value, b.collateral_type, b.collateral_value,
               b.income_source, b.months_at_current_job,
               b.income_consistency_score, b.alternative_credit_score,
               b.months_employed, b.num_credit_lines, b.interest_rate, b.education,
               b.has_mortgage, b.has_dependents, b.has_cosigner, b.created_at,
               r.id as score_id, r.score, r.bucket, r.model_version, r.scored_at
        FROM borrowers b
        LEFT JOIN (
          SELECT DISTINCT ON (borrower_id) id, borrower_id, score, bucket, model_version, scored_at
          FROM risk_scores
          ORDER BY borrower_id, scored_at DESC
        ) r ON b.id = r.borrower_id
        ${whereClause}
        ORDER BY b.external_id ASC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `
      const dataParams = [...params, pageSize, offset]
      const rows = await queryMany<any>(dataSql, dataParams)

      const standardized = rows.map((b: any) => ({
        id: b.id,
        external_id: b.external_id || b.id.slice(0, 8),
        full_name: b.full_name || 'Unknown',
        email: b.email,
        loan_type: b.loan_type || 'Standard',
        loan_amount: Number(b.loan_amount || 0),
        outstanding_balance: Number(b.outstanding_balance || 0),
        geography: b.geography || 'Global',
        tenure_months: Number(b.tenure_months || 0),
        monthly_income: Number(b.monthly_income || 0),
        employment_status: b.employment_status || 'Unknown',
        age: b.age != null ? Number(b.age) : undefined,
        date_of_birth: b.date_of_birth,
        num_dependents: b.num_dependents != null ? Number(b.num_dependents) : 0,
        marital_status: b.marital_status,
        existing_credit_card_debt: Number(b.existing_credit_card_debt || 0),
        existing_auto_loans: Number(b.existing_auto_loans || 0),
        existing_personal_loans: Number(b.existing_personal_loans || 0),
        alimony_obligations: Number(b.alimony_obligations || 0),
        real_estate_value: Number(b.real_estate_value || 0),
        liquid_savings: Number(b.liquid_savings || 0),
        investment_portfolio_value: Number(b.investment_portfolio_value || 0),
        collateral_type: b.collateral_type || 'none',
        collateral_value: Number(b.collateral_value || 0),
        income_source: b.income_source || 'wages',
        months_at_current_job: Number(b.months_at_current_job || b.months_employed || 24),
        income_consistency_score: Number(b.income_consistency_score || 0.7),
        alternative_credit_score: b.alternative_credit_score != null ? Number(b.alternative_credit_score) : undefined,
        months_employed: Number(b.months_employed || b.months_at_current_job || 24),
        num_credit_lines: Number(b.num_credit_lines || 3),
        interest_rate: Number(b.interest_rate || 10.5),
        education: b.education || "Bachelor's",
        has_mortgage: Boolean(b.has_mortgage),
        has_dependents: Boolean(b.has_dependents || (b.num_dependents && b.num_dependents > 0)),
        has_cosigner: Boolean(b.has_cosigner),
        risk_scores: b.score != null ? [{
          id: b.score_id,
          score: Number(b.score),
          bucket: b.bucket,
          model_version: b.model_version || 'v1.0',
          scored_at: b.scored_at
        }] : [],
      }))

      return NextResponse.json({
        data: standardized,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      })
    } catch (rdsErr) {
      console.warn('[Borrowers API] RDS query error, falling back to Supabase:', rdsErr)
    }
  }

  // 2. Secondary Data Source: Supabase fallback (with legacy column tolerance)
  let query = supabase
    .from('borrowers')
    .select(
      'id, external_id, full_name, email, loan_type, loan_amount, outstanding_balance, geography, tenure_months, monthly_income, employment_status, age, date_of_birth, num_dependents, marital_status, existing_credit_card_debt, existing_auto_loans, existing_personal_loans, alimony_obligations, real_estate_value, liquid_savings, investment_portfolio_value, collateral_type, collateral_value, income_source, months_at_current_job, income_consistency_score, alternative_credit_score, risk_scores!inner(id, score, bucket, model_version, scored_at)',
      { count: 'exact' }
    )
    .order('external_id', { ascending: true })

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,external_id.ilike.%${search}%`)
  }

  if (bucket && ['low', 'medium', 'high', 'critical'].includes(bucket)) {
    query = query.eq('risk_scores.bucket', bucket)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)

  if (error) {
    console.error('Error fetching borrowers from Supabase, trying fallback:', error)
    const fallbackQuery = supabase
      .from('borrowers')
      .select('*, risk_scores!inner(id, score, bucket, model_version, scored_at)', { count: 'exact' })
      .order('external_id', { ascending: true })

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
      months_at_current_job: Number(b.months_at_current_job || b.months_employed || 0),
      income_consistency_score: Number(b.income_consistency_score || 0.5),
      alternative_credit_score: b.alternative_credit_score != null ? Number(b.alternative_credit_score) : undefined,
      months_employed: b.months_employed != null ? Number(b.months_employed) : b.months_at_current_job != null ? Number(b.months_at_current_job) : undefined,
      num_credit_lines: b.num_credit_lines != null ? Number(b.num_credit_lines) : undefined,
      interest_rate: b.interest_rate != null ? Number(b.interest_rate) : undefined,
      education: b.education || b.education_level || undefined,
      has_mortgage: b.has_mortgage ?? undefined,
      has_dependents: b.has_dependents ?? (b.num_dependents != null ? b.num_dependents > 0 : undefined),
      has_cosigner: b.has_cosigner ?? undefined,
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

  const standardized = (data || []).map((b: any) => ({
    ...b,
    months_employed: b.months_employed != null ? Number(b.months_employed) : b.months_at_current_job != null ? Number(b.months_at_current_job) : undefined,
    num_credit_lines: b.num_credit_lines != null ? Number(b.num_credit_lines) : undefined,
    interest_rate: b.interest_rate != null ? Number(b.interest_rate) : undefined,
    education: b.education || b.education_level || undefined,
    has_mortgage: b.has_mortgage ?? undefined,
    has_dependents: b.has_dependents ?? (b.num_dependents != null ? b.num_dependents > 0 : undefined),
    has_cosigner: b.has_cosigner ?? undefined,
  }))

  const total = count || 0
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

    const monthsEmployed = Number(body.months_employed ?? body.months_at_current_job ?? 24)
    const numCreditLines = Number(body.num_credit_lines ?? 3)
    const interestRate = Number(body.interest_rate ?? 10.5)
    const education = body.education || body.education_level || "Bachelor's"
    const hasMortgage = Boolean(body.has_mortgage)
    const hasDependents = Boolean(body.has_dependents ?? (body.num_dependents && body.num_dependents > 0))
    const hasCoSigner = Boolean(body.has_cosigner)

    const borrowerPayload = {
      external_id,
      full_name: body.full_name,
      email: body.email,
      loan_type: (body.loan_type === 'Personal' || body.loan_type === 'Personal Loan') ? 'Other' : (body.loan_type || 'Other'),
      loan_amount: Number(body.loan_amount || 10000),
      outstanding_balance: Number(body.outstanding_balance ?? body.loan_amount ?? 10000),
      geography: body.geography || 'North America',
      tenure_months: Number(body.tenure_months || 36),
      monthly_income: Number(body.monthly_income || 5000),
      employment_status: body.employment_status || 'Employed',
      age: body.age ? Number(body.age) : null,
      date_of_birth: body.date_of_birth || null,
      num_dependents: Number(body.num_dependents ?? (hasDependents ? 1 : 0)),
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
      months_at_current_job: monthsEmployed,
      income_consistency_score: Number(body.income_consistency_score || 0.75),
      alternative_credit_score: body.alternative_credit_score ? Number(body.alternative_credit_score) : null,
      // Core Model Inputs
      months_employed: monthsEmployed,
      num_credit_lines: numCreditLines,
      interest_rate: interestRate,
      education: education,
      has_mortgage: hasMortgage,
      has_dependents: hasDependents,
      has_cosigner: hasCoSigner,
      // Dataset v2 Underwriting Predictors
      credit_utilization: Number(body.credit_utilization ?? 0.38),
      delinquency_count_12m: Number(body.delinquency_count_12m ?? 0),
      num_inquiries_6m: Number(body.num_inquiries_6m ?? 1),
      prior_defaults: Number(body.prior_defaults ?? 0),
    }

    // Insert borrower into RDS if available
    let newBorrowerId: string | null = null

    if (process.env.DATABASE_URL) {
      try {
        const { queryOne } = await import('@/lib/db/postgres')
        const rdsResult = await queryOne(
          `INSERT INTO borrowers (
            external_id, full_name, email, loan_type, loan_amount, outstanding_balance,
            geography, tenure_months, monthly_income, employment_status,
            age, date_of_birth, num_dependents, marital_status,
            existing_credit_card_debt, existing_auto_loans, existing_personal_loans, alimony_obligations,
            real_estate_value, liquid_savings, investment_portfolio_value, collateral_type, collateral_value,
            income_source, months_at_current_job, income_consistency_score, alternative_credit_score,
            months_employed, num_credit_lines, interest_rate, education, has_mortgage, has_dependents, has_cosigner
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34)
          RETURNING id`,
          [
            borrowerPayload.external_id, borrowerPayload.full_name, borrowerPayload.email, borrowerPayload.loan_type,
            borrowerPayload.loan_amount, borrowerPayload.outstanding_balance, borrowerPayload.geography,
            borrowerPayload.tenure_months, borrowerPayload.monthly_income, borrowerPayload.employment_status,
            borrowerPayload.age, borrowerPayload.date_of_birth,
            borrowerPayload.num_dependents, borrowerPayload.marital_status, borrowerPayload.existing_credit_card_debt,
            borrowerPayload.existing_auto_loans, borrowerPayload.existing_personal_loans, borrowerPayload.alimony_obligations,
            borrowerPayload.real_estate_value, borrowerPayload.liquid_savings, borrowerPayload.investment_portfolio_value,
            borrowerPayload.collateral_type, borrowerPayload.collateral_value, borrowerPayload.income_source,
            borrowerPayload.months_at_current_job, borrowerPayload.income_consistency_score,
            borrowerPayload.alternative_credit_score,
            borrowerPayload.months_employed, borrowerPayload.num_credit_lines, borrowerPayload.interest_rate,
            borrowerPayload.education, borrowerPayload.has_mortgage, borrowerPayload.has_dependents, borrowerPayload.has_cosigner
          ]
        )
        if (rdsResult) newBorrowerId = rdsResult.id
      } catch (rdsErr) {
        console.warn('RDS insert error, trying fallback without new columns:', rdsErr)
      }
    }

    // Insert borrower into Supabase backup
    let sbData: any = null
    const { data: primarySb, error: sbError } = await supabase
      .from('borrowers')
      .insert({
        ...(newBorrowerId ? { id: newBorrowerId } : {}),
        ...borrowerPayload
      })
      .select()
      .single()

    if (!sbError) {
      sbData = primarySb
    } else {
      const { months_employed, num_credit_lines, interest_rate, education, has_mortgage, has_dependents, has_cosigner, credit_utilization, delinquency_count_12m, num_inquiries_6m, prior_defaults, ...legacyPayload } = borrowerPayload
      const { data: fallbackSb, error: fallbackSbErr } = await supabase
        .from('borrowers')
        .insert({
          ...(newBorrowerId ? { id: newBorrowerId } : {}),
          ...legacyPayload
        })
        .select()
        .single()
      if (fallbackSb) sbData = fallbackSb
      if (fallbackSbErr && !newBorrowerId) {
        return NextResponse.json({ error: { code: 'INSERT_FAILED', message: fallbackSbErr.message } }, { status: 500 })
      }
    }

    const borrowerId = newBorrowerId || sbData?.id

    // Seed initial risk_scores record so borrower immediately shows in monitored table
    if (borrowerId) {
      const initialScore = Number(body.initial_score ?? 0.28)
      const initialBucket = body.initial_tier ?? (initialScore < 0.3 ? 'low' : initialScore < 0.6 ? 'medium' : initialScore < 0.85 ? 'high' : 'critical')

      if (process.env.DATABASE_URL) {
        try {
          const { queryOne } = await import('@/lib/db/postgres')
          await queryOne(
            `INSERT INTO risk_scores (borrower_id, score, bucket, model_version, scored_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [borrowerId, initialScore, initialBucket, 'v2.1-xgboost-production']
          )
        } catch (rsErr) {
          console.warn('Initial RDS risk_scores insert note:', rsErr)
        }
      }

      try {
        await supabase.from('risk_scores').insert({
          borrower_id: borrowerId,
          score: initialScore,
          bucket: initialBucket,
          model_version: 'v2.1-xgboost-production',
        })
      } catch {
        // Non-blocking fallback
      }
    }

    return NextResponse.json({ data: sbData || { id: borrowerId, ...borrowerPayload } }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: { code: 'SERVER_ERROR', message: err.message } }, { status: 500 })
  }
}
