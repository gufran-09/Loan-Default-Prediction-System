import { NextResponse } from 'next/server'
import { clearAuthCookies } from '@/lib/auth/session'

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Signed out successfully.' })
  return clearAuthCookies(response)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const redirectUrl = new URL('/signin', url.origin)
  const response = NextResponse.redirect(redirectUrl)
  return clearAuthCookies(response)
}
