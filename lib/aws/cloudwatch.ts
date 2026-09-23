import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs'

let cwClient: CloudWatchLogsClient | null = null

function getClient() {
  if (!cwClient) {
    cwClient = new CloudWatchLogsClient({
      region: process.env.AWS_REGION || 'ap-southeast-2',
    })
  }
  return cwClient
}

export interface UnderwriterAuditEntry {
  correlationId?: string
  underwriterId: string
  borrowerId: string
  action: 'APPROVED' | 'REJECTED' | 'MANUAL_OVERRIDE' | 'REVIEWED' | 'RESCORED'
  score?: number
  bucket?: string
  overrideDelta?: number
  justification?: string
  metadata?: Record<string, any>
}

/**
 * Sends real-time compliance and audit logs to Amazon CloudWatch
 * Complies with OCC SR 11-7 Model Risk Management guidelines.
 */
export async function logUnderwriterAudit(entry: UnderwriterAuditEntry): Promise<void> {
  const isEnabled = process.env.AWS_CLOUDWATCH_ENABLED === 'true'
  const logGroupName = process.env.AWS_CLOUDWATCH_LOG_GROUP || '/aegis-risk/audit-trail'
  const logStreamName = 'underwriter-decisions'

  const messagePayload = JSON.stringify({
    timestamp: new Date().toISOString(),
    event_type: 'SR_11_7_UNDERWRITER_AUDIT',
    source: 'AegisRisk-WebUI',
    ...entry
  })

  // If CloudWatch client/env is not configured, record in stdout
  if (!isEnabled) {
    console.log('[Audit Log Local]:', messagePayload)
    return
  }

  try {
    const client = getClient()
    const command = new PutLogEventsCommand({
      logGroupName,
      logStreamName,
      logEvents: [
        {
          timestamp: Date.now(),
          message: messagePayload,
        },
      ],
    })
    await client.send(command)
  } catch (error) {
    console.warn('[AWS CloudWatch Audit Warning] Could not forward event:', error)
  }
}
