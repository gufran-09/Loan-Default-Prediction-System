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
  const status = url.searchParams.get('status')
  const severity = url.searchParams.get('severity')

  // 1. Primary: Amazon RDS PostgreSQL (93 calibrated alerts on LN- borrowers)
  if (process.env.DATABASE_URL) {
    try {
      const { queryMany } = await import('@/lib/db/postgres')

      let whereConditions: string[] = []
      let params: any[] = []
      let paramIdx = 1

      if (status && ['open', 'acknowledged', 'resolved'].includes(status)) {
        whereConditions.push(`LOWER(a.status) = $${paramIdx}`)
        params.push(status.toLowerCase())
        paramIdx++
      }

      if (severity && ['high', 'medium', 'low', 'critical'].includes(severity)) {
        whereConditions.push(`LOWER(a.severity) = $${paramIdx}`)
        params.push(severity.toLowerCase())
        paramIdx++
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

      const sql = `
        SELECT a.id, a.borrower_id, a.title, a.description, a.severity, a.status, a.created_at,
               b.id as b_id, b.external_id, b.full_name, b.email, b.loan_amount, b.outstanding_balance
        FROM alerts a
        LEFT JOIN borrowers b ON a.borrower_id = b.id
        ${whereClause}
        ORDER BY a.created_at DESC
      `
      const rows = await queryMany<any>(sql, params)

      const standardized = rows.map((a: any) => ({
        id: a.id,
        borrower_id: a.borrower_id,
        title: a.title,
        description: a.description,
        severity: a.severity?.toLowerCase() || 'medium',
        status: a.status?.toLowerCase() || 'open',
        created_at: a.created_at,
        borrowers: {
          id: a.b_id || a.borrower_id,
          external_id: a.external_id || a.borrower_id?.slice(0, 8),
          full_name: a.full_name || 'Borrower',
          email: a.email || '',
          loan_amount: Number(a.loan_amount || 0),
          outstanding_balance: Number(a.outstanding_balance || 0),
        },
      }))

      return NextResponse.json({ data: standardized })
    } catch (rdsErr) {
      console.warn('[Alerts API] RDS query error, falling back to Supabase:', rdsErr)
    }
  }

  // 2. Secondary: Supabase fallback
  let query = supabase
    .from('alerts')
    .select('id, borrower_id, title, description, severity, status, created_at, borrowers(id, external_id, full_name, email, loan_amount, outstanding_balance)')
    .order('created_at', { ascending: false })

  if (status && ['open', 'acknowledged', 'resolved'].includes(status)) {
    query = query.eq('status', status)
  }

  if (severity && ['high', 'medium', 'low', 'critical'].includes(severity)) {
    query = query.eq('severity', severity)
  }

  const { data, error } = await query

  if (error) {
    const fallback = await supabase
      .from('alerts')
      .select('*, borrowers(name, email)')
      .order('created_at', { ascending: false })

    if (fallback.error) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Unable to load alerts' } },
        { status: 500 }
      )
    }

    const standardized = (fallback.data || []).map((a: any) => ({
      ...a,
      borrowers: {
        id: a.borrowers?.id,
        external_id: a.borrowers?.external_id || a.borrower_id?.slice(0, 8),
        full_name: a.borrowers?.full_name || a.borrowers?.name || 'Borrower',
        email: a.borrowers?.email,
      },
    }))

    return NextResponse.json({ data: standardized })
  }

  return NextResponse.json({ data: data || [] })
}
