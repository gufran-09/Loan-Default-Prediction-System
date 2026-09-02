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

  // Select borrowers with nested latest risk_scores
  let query = supabase
    .from('borrowers')
    .select(
      'id, external_id, full_name, email, loan_type, loan_amount, outstanding_balance, geography, tenure_months, monthly_income, employment_status, risk_scores!inner(id, score, bucket, model_version, scored_at)',
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
    // If the schema was legacy (name instead of full_name), perform adaptive fallback
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
