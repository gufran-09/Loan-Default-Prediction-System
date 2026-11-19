import { NextResponse } from 'next/server'
import { signUpCognitoUser } from '@/lib/auth/cognitoService'
import { setAuthCookies } from '@/lib/auth/session'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, fullName } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: { message: 'Email and password are required.' } },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: { message: 'Password must be at least 8 characters long.' } },
        { status: 400 }
      )
    }

    // 1. Primary: Register in AWS Cognito User Pool
    const cognitoRes = await signUpCognitoUser(email, password, fullName || email.split('@')[0])

    if (cognitoRes.success && cognitoRes.user) {
      const response = NextResponse.json({
        success: true,
        user: cognitoRes.user,
        message: 'Account created successfully in AWS Cognito.',
      })
      return setAuthCookies(response, cognitoRes.user, cognitoRes.tokens, request)
    }

    // If Cognito returned an error (e.g. user already exists, or password policy)
    if (cognitoRes.error && !cognitoRes.error.includes('Missing credentials')) {
      return NextResponse.json(
        { error: { message: cognitoRes.error } },
        { status: 400 }
      )
    }

    // 2. Fallback: Local underwriter session if Cognito client is unreachable
    const fallbackUser = {
      id: email.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      name: fullName?.trim() || email.split('@')[0],
      role: 'Underwriter',
    }

    const response = NextResponse.json({
      success: true,
      user: fallbackUser,
      message: 'Account created successfully (local underwriter session).',
    })
    return setAuthCookies(response, fallbackUser, undefined, request)

  } catch (err: any) {
    console.error('[Auth SignUp Error]:', err)
    return NextResponse.json(
      { error: { message: err.message || 'An unexpected error occurred during signup.' } },
      { status: 500 }
    )
  }
}
