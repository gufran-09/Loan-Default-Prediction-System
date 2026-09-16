import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: borrowerId } = await params
  const supabase = await createClient()

  // 1. RDS PostgreSQL (Primary)
  if (process.env.DATABASE_URL) {
    try {
      const { queryMany } = await import('@/lib/db/postgres')
      const rows = await queryMany(
        `SELECT id, borrower_id, score, bucket, model_version, scoring_method,
                feature_snapshot, shap_values, scored_at
         FROM scoring_history
         WHERE borrower_id = $1
         ORDER BY scored_at ASC`,
        [borrowerId]
      )
      if (rows && rows.length > 0) {
        return NextResponse.json({ data: rows })
      }
    } catch (rdsErr) {
      console.warn('[Scoring History API] RDS query error:', rdsErr)
    }
  }

  // 2. Supabase Fallback
  const { data, error } = await supabase
    .from('scoring_history')
    .select('*')
    .eq('borrower_id', borrowerId)
    .order('scored_at', { ascending: true })

  if (error) {
    return NextResponse.json({ data: [] })
  }

  return NextResponse.json({ data: data || [] })
}
