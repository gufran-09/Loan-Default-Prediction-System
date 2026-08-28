import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { status } = body

    if (!['open', 'acknowledged', 'resolved'].includes(status)) {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid status' } }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('alerts')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Unable to update alert' } }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid request body' } }, { status: 400 })
  }
}
