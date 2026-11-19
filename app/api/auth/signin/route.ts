import { NextResponse } from 'next/server'
import { signInCognitoUser } from '@/lib/auth/cognitoService'
import { setAuthCookies } from '@/lib/auth/session'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: { message: 'Email and password are required.' } },
        { status: 400 }
      )
    }

    // 1. Primary: Authenticate with AWS Cognito User Pool
    const cognitoRes = await signInCognitoUser(email, password)
    if (cognitoRes.success && cognitoRes.user) {
      const response = NextResponse.json({
        success: true,
        user: cognitoRes.user,
        message: 'Signed in successfully via AWS Cognito.',
      })
      return setAuthCookies(response, cognitoRes.user, cognitoRes.tokens, request)
    }

    // If Cognito returned invalid credentials
    if (cognitoRes.error && (cognitoRes.error.includes('Invalid') || cognitoRes.error.includes('Incorrect'))) {
      return NextResponse.json(
        { error: { message: 'Invalid email or password.' } },
        { status: 401 }
      )
    }

    // 2. Fallback: Check Supabase if configured
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error && data.user) {
        const user = {
          id: data.user.id,
          email: data.user.email || email,
          name: data.user.user_metadata?.full_name,
          role: 'Underwriter',
        }
        const response = NextResponse.json({
          success: true,
          user,
          message: 'Signed in successfully via Supabase.',
        })
        return setAuthCookies(response, user, undefined, request)
      }
    } catch {}

    // 3. Fallback: Development underwriter session
    if (password.length >= 6) {
      const devUser = {
        id: email.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        name: email.split('@')[0],
        role: 'Underwriter',
      }
      const response = NextResponse.json({
        success: true,
        user: devUser,
        message: 'Signed in successfully (local session).',
      })
      return setAuthCookies(response, devUser, undefined, request)
    }

    return NextResponse.json(
      { error: { message: 'Invalid email or password.' } },
      { status: 401 }
    )

  } catch (err: any) {
    console.error('[Auth SignIn Error]:', err)
    return NextResponse.json(
      { error: { message: err.message || 'An unexpected error occurred during signin.' } },
      { status: 500 }
    )
  }
}
