import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppNotification } from '@/lib/aws/whatsapp'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { phoneNumber, borrowerName, score, bucket, reasons, status } = body

  if (!phoneNumber) {
    return NextResponse.json({ error: 'Recipient phone number is required' }, { status: 400 })
  }

  const result = await sendWhatsAppNotification({
    recipientPhoneNumber: phoneNumber,
    borrowerName: borrowerName || 'Borrower',
    borrowerId: id.slice(0, 8).toUpperCase(),
    score: Number(score || 500),
    bucket: bucket || 'MEDIUM',
    reasons: reasons || [],
    status: status || (Number(score) >= 650 ? 'DECLINED' : Number(score) >= 450 ? 'MANUAL_REVIEW' : 'APPROVED'),
  })

  return NextResponse.json({ data: result })
}
