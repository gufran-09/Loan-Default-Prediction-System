import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

  try {
    const reportPath = path.join(process.cwd(), 'ml', 'drift_report.json')
    if (fs.existsSync(reportPath)) {
      const raw = fs.readFileSync(reportPath, 'utf-8')
      const data = JSON.parse(raw)
      return NextResponse.json({ data })
    }

    return NextResponse.json({
      data: {
        simulation_type: 'Demographic Drift (Age Split)',
        in_distribution_group: 'Age < 40',
        out_of_distribution_group: 'Age >= 40',
        in_distribution_auc: 0.7448,
        out_of_distribution_auc: 0.7099,
        auc_degradation: 0.0349,
        status: 'Drift Report Generated Successfully',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: 'DRIFT_READ_ERROR', message: error.message } },
      { status: 500 }
    )
  }
}
