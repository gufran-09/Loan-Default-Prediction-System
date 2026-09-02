import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScore } from '@/lib/scoring/getScore'

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Borrower ID is required' } },
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

  const scoreData = await getScore(id)

  if (!scoreData) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Borrower risk assessment not found' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: scoreData })
}
