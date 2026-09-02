import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Alert ID is required' } },
      { status: 400 }
    )
  }

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

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } },
      { status: 400 }
    )
  }

  const { status } = body
  const validStatuses = ['open', 'acknowledged', 'resolved']

  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        },
      },
      { status: 400 }
    )
  }

  // Update alert record
  const { data, error } = await supabase
    .from('alerts')
    .update({ status })
    .eq('id', id)
    .select('*, borrowers(id, external_id, full_name, email)')
    .single()

  if (error) {
    console.error('Failed to update alert:', error)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to update alert status' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data,
    message: `Alert status updated to ${status}`,
  })
}
