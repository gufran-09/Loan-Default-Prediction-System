import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const telemetryData = {
      session_id: body.session_id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      borrower_id: body.borrower_id || null,
      form_start_time: body.form_start_time || new Date().toISOString(),
      form_submit_time: body.form_submit_time || new Date().toISOString(),
      total_fill_duration_seconds: Number(body.total_fill_duration_seconds || 0),
      field_revision_count: Number(body.field_revision_count || 0),
      copy_paste_detected: Boolean(body.copy_paste_detected),
      inconsistency_flags: Array.isArray(body.inconsistency_flags) ? body.inconsistency_flags : [],
      device_fingerprint: body.device_fingerprint || null,
      ip_geo_location: body.ip_geo_location || null,
    }

    // 1. RDS PostgreSQL (Primary)
    if (process.env.DATABASE_URL) {
      try {
        const { queryOne } = await import('@/lib/db/postgres')
        await queryOne(
          `INSERT INTO session_telemetry (
            session_id, borrower_id, form_start_time, form_submit_time,
            total_fill_duration_seconds, field_revision_count, copy_paste_detected,
            inconsistency_flags, device_fingerprint, ip_geo_location
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id`,
          [
            telemetryData.session_id,
            telemetryData.borrower_id,
            telemetryData.form_start_time,
            telemetryData.form_submit_time,
            telemetryData.total_fill_duration_seconds,
            telemetryData.field_revision_count,
            telemetryData.copy_paste_detected,
            JSON.stringify(telemetryData.inconsistency_flags),
            telemetryData.device_fingerprint,
            telemetryData.ip_geo_location,
          ]
        )
      } catch (rdsErr) {
        console.warn('[Telemetry API] RDS write note:', rdsErr)
      }
    }

    // 2. Supabase Fallback/Backup
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('session_telemetry')
      .insert(telemetryData)
      .select()
      .maybeSingle()

    if (error) {
      console.warn('[Telemetry API] Supabase write note:', error)
    }

    return NextResponse.json({
      success: true,
      data: data || telemetryData,
    })
  } catch (err: any) {
    console.error('Failed to log telemetry:', err)
    return NextResponse.json({ error: { message: err.message } }, { status: 500 })
  }
}
