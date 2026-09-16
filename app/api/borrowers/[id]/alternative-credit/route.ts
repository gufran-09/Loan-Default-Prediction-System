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
      const records = await queryMany(
        `SELECT id, borrower_id, data_type, provider_name, months_of_history,
                on_time_payment_rate, average_monthly_amount, last_updated
         FROM alternative_credit_data
         WHERE borrower_id = $1
         ORDER BY last_updated DESC`,
        [borrowerId]
      )
      if (records && records.length > 0) {
        return NextResponse.json({ data: records })
      }
    } catch (rdsErr) {
      console.warn('[Alt Credit API] RDS query error:', rdsErr)
    }
  }

  // 2. Supabase Fallback
  const { data, error } = await supabase
    .from('alternative_credit_data')
    .select('*')
    .eq('borrower_id', borrowerId)
    .order('last_updated', { ascending: false })

  if (error) {
    return NextResponse.json({ data: [] })
  }

  return NextResponse.json({ data: data || [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: borrowerId } = await params
  const supabase = await createClient()

  try {
    const body = await request.json()
    const {
      data_type,
      provider_name,
      months_of_history,
      on_time_payment_rate,
      average_monthly_amount,
    } = body

    const onTimeRate = Math.max(0, Math.min(1.0, Number(on_time_payment_rate || 0.95)))
    const months = Math.max(1, Number(months_of_history || 12))
    const avgAmount = Number(average_monthly_amount || 120)

    // Calculate updated alternative credit score
    // 300 to 850 score range based on payment consistency and length of history
    const baseScore = 500
    const onTimeComponent = onTimeRate * 300 // up to 300 pts
    const historyComponent = Math.min(50, months * 2) // up to 50 pts
    const calculatedAltScore = Math.round(baseScore + onTimeComponent + historyComponent)

    const payload = {
      borrower_id: borrowerId,
      data_type: data_type || 'utility_payment',
      provider_name: provider_name || 'Consolidated Energy & Telecom',
      months_of_history: months,
      on_time_payment_rate: onTimeRate,
      average_monthly_amount: avgAmount,
      last_updated: new Date().toISOString(),
    }

    // RDS Insert
    if (process.env.DATABASE_URL) {
      try {
        const { queryOne } = await import('@/lib/db/postgres')
        await queryOne(
          `INSERT INTO alternative_credit_data (
            borrower_id, data_type, provider_name, months_of_history,
            on_time_payment_rate, average_monthly_amount, last_updated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id`,
          [
            payload.borrower_id, payload.data_type, payload.provider_name,
            payload.months_of_history, payload.on_time_payment_rate,
            payload.average_monthly_amount, payload.last_updated
          ]
        )
        // Update borrower's alternative credit score
        await queryOne(
          `UPDATE borrowers SET alternative_credit_score = $1 WHERE id = $2`,
          [calculatedAltScore, borrowerId]
        )
      } catch (rdsErr) {
        console.warn('[Alt Credit API] RDS insert error:', rdsErr)
      }
    }

    // Supabase Insert & Update
    const { data: inserted, error: insertError } = await supabase
      .from('alternative_credit_data')
      .insert(payload)
      .select()
      .maybeSingle()

    await supabase
      .from('borrowers')
      .update({ alternative_credit_score: calculatedAltScore })
      .eq('id', borrowerId)

    return NextResponse.json({
      success: true,
      data: inserted || payload,
      calculated_score: calculatedAltScore,
    })
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message } }, { status: 500 })
  }
}
