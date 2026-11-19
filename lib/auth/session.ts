import { NextResponse } from 'next/server'
import { verifyCognitoToken } from './cognitoJwt'

export interface SessionUser {
  id: string
  email: string
  name?: string
  role?: string
}

const SESSION_COOKIE_NAME = 'aegis_session'
const COGNITO_ID_TOKEN_NAME = 'cognito_id_token'
const COGNITO_ACCESS_TOKEN_NAME = 'cognito_access_token'

export const DEFAULT_PUBLIC_USER: SessionUser = {
  id: 'risk-officer',
  email: 'officer@aegisrisk.io',
  name: 'Risk Officer',
  role: 'Underwriter',
}

/**
 * Returns the active workspace user (direct access enabled without login gate)
 */
export async function getSessionUser(_request: Request): Promise<SessionUser> {
  return DEFAULT_PUBLIC_USER
}

/**
 * Attaches auth session cookies to a NextResponse
 */
export function setAuthCookies(
  response: NextResponse,
  user: SessionUser,
  tokens?: { idToken?: string; accessToken?: string },
  request?: Request
): NextResponse {
  const maxAge = 60 * 60 * 24 * 7 // 7 days
  const forwardedProto = request?.headers.get('x-forwarded-proto')
  const isHttps =
    forwardedProto === 'https' ||
    Boolean(request?.url?.startsWith('https://'))

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeURIComponent(JSON.stringify(user)),
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge,
  })

  if (tokens?.idToken) {
    response.cookies.set({
      name: COGNITO_ID_TOKEN_NAME,
      value: tokens.idToken,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge,
    })
  }

  if (tokens?.accessToken) {
    response.cookies.set({
      name: COGNITO_ACCESS_TOKEN_NAME,
      value: tokens.accessToken,
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge,
    })
  }

  return response
}

/**
 * Clears auth session cookies from a NextResponse
 */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(SESSION_COOKIE_NAME)
  response.cookies.delete(COGNITO_ID_TOKEN_NAME)
  response.cookies.delete(COGNITO_ACCESS_TOKEN_NAME)
  return response
}

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!header) return result
  for (const pair of header.split(';')) {
    const [k, ...v] = pair.trim().split('=')
    if (k) result[k] = v.join('=')
  }
  return result
}
