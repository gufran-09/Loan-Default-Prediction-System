import { NextResponse } from 'next/server'
import { parseBorrowerIncomeDocument } from '@/lib/aws/textract'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: { message: 'No document file provided. Please upload a PDF, PNG, or JPEG.' } },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    const extraction = await parseBorrowerIncomeDocument(uint8Array)

    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      data: extraction,
    })
  } catch (err: any) {
    console.error('[Document Parse Error]:', err)
    return NextResponse.json(
      { error: { message: err?.message || 'Failed to process financial document' } },
      { status: 500 }
    )
  }
}
