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
    // Fallback if schema was legacy (name instead of full_name)
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
