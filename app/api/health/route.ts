import { NextResponse } from 'next/server'
import { checkDbHealth } from '@/lib/db/postgres'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const isReadiness = url.searchParams.get('ready') === 'true'

  const startTime = Date.now()
  const dbHealth = await checkDbHealth()

  // Verify ML model artifact integrity
  let modelStatus = 'ready'
  let modelError: string | undefined
  try {
    const modelPath = path.join(process.cwd(), 'ml', 'model.json')
    if (!fs.existsSync(modelPath)) {
      modelStatus = 'missing'
      modelError = 'ml/model.json artifact not found on filesystem'
    }
  } catch (err: any) {
    modelStatus = 'error'
    modelError = err.message
  }

  const overallHealthy = dbHealth.status === 'healthy' && modelStatus === 'ready'
  const statusCode = isReadiness && !overallHealthy ? 503 : 200

  return NextResponse.json(
    {
      status: overallHealthy ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'production',
      aws_region: process.env.AWS_REGION || 'ap-southeast-2',
      checks: {
        database: dbHealth,
        model_artifact: {
          status: modelStatus,
          error: modelError,
        },
      },
      latency_ms: Date.now() - startTime,
    },
    { status: statusCode }
  )
}
