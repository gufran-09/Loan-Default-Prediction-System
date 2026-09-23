/**
 * Aegis Risk — WhatsApp Business Notification Service
 * Integrates with Meta WhatsApp Business Cloud API & AWS Lambda/Step Functions.
 * 
 * Features:
 * - Direct Meta Cloud API delivery (1,000 free conversations/month)
 * - Safe dry-run simulation mode when credentials are not configured
 * - Formatted institutional credit assessment messages
 */

import { whatsappCircuitBreaker } from '@/lib/resilience/circuitBreaker'

export interface WhatsAppNotificationPayload {
  recipientPhoneNumber: string // Format: "+1234567890" or "+919876543210"
  borrowerName: string
  borrowerId: string
  score: number
  bucket: string
  reasons?: Array<{ reason: string }>
  status: 'APPROVED' | 'MANUAL_REVIEW' | 'DECLINED'
}

export async function sendWhatsAppNotification(payload: WhatsAppNotificationPayload): Promise<{
  success: boolean
  simulated: boolean
  messageId?: string
  error?: string
}> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const cleanPhone = payload.recipientPhoneNumber.replace(/[^0-9+]/g, '')

  // Compose formatted institutional alert
  const statusEmoji = payload.status === 'APPROVED' ? '✅' : payload.status === 'DECLINED' ? '⚠️' : '🔍'
  const reasonBullet = payload.reasons && payload.reasons.length > 0
    ? `\n*Primary Factor:* ${payload.reasons[0].reason}`
    : ''

  const messageText = `🏦 *Aegis Risk — Credit Assessment Notification*

Dear *${payload.borrowerName}*,

Your credit facility evaluation for Reference *#${payload.borrowerId}* has been completed:

• *Assigned Risk Rating:* ${payload.score}/1000 (${payload.bucket} RISK)
• *Underwriting Status:* ${statusEmoji} *${payload.status.replace('_', ' ')}*${reasonBullet}

_Notice issued in accordance with institutional OCC SR 11-7 model standards._`

  // 1. If API credentials are not set, run in structured dry-run mode
  if (!phoneNumberId || !accessToken) {
    console.log(`[WHATSAPP DISPATCHER (Simulation Mode)]: Delivered to ${cleanPhone}:`, {
      borrower: payload.borrowerName,
      score: payload.score,
      bucket: payload.bucket,
      status: payload.status,
      message_preview: messageText,
    })
    return {
      success: true,
      simulated: true,
      messageId: `wamid_simulated_${Date.now()}`,
    }
  }

  // 2. Live production dispatch via Meta WhatsApp Business Cloud API protected by Circuit Breaker
  return whatsappCircuitBreaker.execute(
    async () => {
      const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`
      const requestBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: messageText,
        },
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        console.warn('[WhatsApp API Dispatch Error]:', errJson)
        throw new Error(errJson.error?.message || `WhatsApp API error: HTTP ${response.status}`)
      }

      const resData = await response.json()
      const messageId = resData.messages?.[0]?.id || 'unknown'
      return {
        success: true,
        simulated: false,
        messageId,
      }
    },
    // Fallback if circuit trips or network failure occurs
    () => {
      console.warn(`[WHATSAPP DISPATCHER (Circuit Breaker Fallback)]: Delivering simulated notice to ${cleanPhone}`)
      return {
        success: true,
        simulated: true,
        messageId: `wamid_circuit_fallback_${Date.now()}`,
      }
    }
  )
}
