import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'

let snsClient: SNSClient | null = null

function getClient() {
  if (!snsClient) {
    snsClient = new SNSClient({
      region: process.env.AWS_REGION || 'ap-southeast-2',
    })
  }
  return snsClient
}

export interface CriticalRiskAlertPayload {
  borrowerId: string
  borrowerName: string
  score: number
  bucket: string
  reasons: Array<{ rank: number; reason: string }>
}

/**
 * Publishes an instant notification to underwriters via Amazon SNS
 * Triggered when risk bucket is CRITICAL (score >= 650)
 */
export async function sendCriticalRiskAlert(payload: CriticalRiskAlertPayload): Promise<boolean> {
  const topicArn = process.env.AWS_SNS_TOPIC_ARN || 'arn:aws:sns:ap-southeast-2:022671037337:aegis-risk-critical-alerts'

  const message = `[AEGIS RISK CRITICAL ALERT]
Borrower ID: ${payload.borrowerId}
Name: ${payload.borrowerName}
Risk Rating: ${payload.score}/1000 (${payload.bucket})
Top Risk Signals:
${payload.reasons.map((r) => ` - Factor ${r.rank}: ${r.reason}`).join('\n')}

Action Required: Manual Underwriter Portfolio Review mandated by OCC SR 11-7 policy.`

  try {
    const client = getClient()
    const command = new PublishCommand({
      TopicArn: topicArn,
      Subject: `CRITICAL RISK ALERT: Loan ${payload.borrowerId} (${payload.score}/1000)`,
      Message: message,
    })
    await client.send(command)
    return true
  } catch (err) {
    console.warn('[AWS SNS Notice] Alert logged (simulation mode):', err)
    return false
  }
}
