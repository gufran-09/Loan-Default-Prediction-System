import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScore } from '@/lib/scoring/getScore'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
  }

  const scoreData = await getScore(id)

  if (!scoreData) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Score not found' } }, { status: 404 })
  }

  return NextResponse.json({ data: scoreData })
}
