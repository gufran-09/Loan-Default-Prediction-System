import { CognitoJwtVerifier } from 'aws-jwt-verify'

const userPoolId = process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID || 'ap-southeast-2_80G23Am1X'
const clientId = process.env.NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID || '74120ugqosjjpmup4utltl1oqf'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let verifier: any = null

export function getCognitoVerifier() {
  if (!verifier && userPoolId && clientId) {
    try {
      verifier = CognitoJwtVerifier.create({
        userPoolId,
        tokenUse: null, // allows verification of both id and access tokens
        clientId,
      })
    } catch (err) {
      console.warn('[Cognito] Could not initialize JWT verifier:', err)
    }
  }
  return verifier
}

export interface CognitoUserSession {
  sub: string
  email?: string
  username?: string
  groups?: string[]
}

export async function verifyCognitoToken(token: string): Promise<CognitoUserSession | null> {
  const v = getCognitoVerifier()
  if (!v) return null

  try {
    const payload = await v.verify(token)
    return {
      sub: payload.sub,
      email: (payload.email as string) || undefined,
      username: (payload['cognito:username'] as string) || (payload.username as string) || undefined,
      groups: (payload['cognito:groups'] as string[]) || [],
    }
  } catch {
    return null
  }
}
