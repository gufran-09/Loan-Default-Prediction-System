import { NextResponse } from 'next/server'
import { sendWhatsAppNotification } from '@/lib/aws/whatsapp'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const { phoneNumber, borrowerName, score, bucket, reasons, status } = body

  if (!phoneNumber) {
    return NextResponse.json({ error: 'Recipient phone number is required' }, { status: 400 })
  }

  const numScore = Number(score)
  const displayScore = isNaN(numScore) ? 500 : (numScore > 0 && numScore <= 1) ? Math.round(numScore * 1000) : Math.round(numScore)

  const result = await sendWhatsAppNotification({
    recipientPhoneNumber: phoneNumber,
    borrowerName: borrowerName || 'Borrower',
    borrowerId: id.slice(0, 8).toUpperCase(),
    score: displayScore,
    bucket: bucket || 'MEDIUM',
    reasons: reasons || [],
    status: status || (displayScore >= 650 ? 'DECLINED' : displayScore >= 450 ? 'MANUAL_REVIEW' : 'APPROVED'),
  })

  return NextResponse.json({ data: result })
}
