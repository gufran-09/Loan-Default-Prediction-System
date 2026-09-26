import { NextResponse } from 'next/server'

// Meta WhatsApp Webhook Endpoint
// Handles verification handshake (GET) and incoming event notifications (POST)

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'aegis_risk_whatsapp_token_2026'

  // Meta sends hub.mode='subscribe' and your verify_token
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WhatsApp Webhook] Handshake verified successfully.')
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  console.warn('[WhatsApp Webhook] Verification token mismatch:', { received: token, expected: verifyToken })
  return NextResponse.json({ error: 'Forbidden: Verification token mismatch' }, { status: 403 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('[WhatsApp Webhook Event]:', JSON.stringify(body, null, 2))

    // Handle delivery receipts, read statuses, and incoming messages
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (value?.statuses) {
      for (const status of value.statuses) {
        console.log(`[WhatsApp Message Status]: ID ${status.id} -> Status: ${status.status}`)
      }
    }

    if (value?.messages) {
      for (const message of value.messages) {
        console.log(`[WhatsApp Inbound Message]: From ${message.from}: ${message.text?.body || message.type}`)
      }
    }

    // Always acknowledge with 200 OK so Meta doesn't retry
    return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 })
  } catch (error: any) {
    console.error('[WhatsApp Webhook Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
