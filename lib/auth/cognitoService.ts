import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider'

const region = process.env.AWS_REGION || 'ap-southeast-2'
const userPoolId = process.env.NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID || 'ap-southeast-2_80G23Am1X'
const clientId = process.env.NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID || '74120ugqosjjpmup4utltl1oqf'

let cognitoClient: CognitoIdentityProviderClient | null = null

function getClient(): CognitoIdentityProviderClient {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient({ region })
  }
  return cognitoClient
}

export interface AuthTokens {
  idToken: string
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

export interface AuthUser {
  id: string
  email: string
  name?: string
  role?: string
}

/**
 * Registers an institutional underwriter in AWS Cognito User Pool
 * Automatically confirms the user and sets permanent password for immediate access.
 */
export async function signUpCognitoUser(
  email: string,
  password: string,
  fullName: string
): Promise<{ success: boolean; tokens?: AuthTokens; user?: AuthUser; error?: string }> {
  const client = getClient()
  const cleanEmail = email.trim().toLowerCase()

  try {
    // 1. Create user in AWS Cognito
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: cleanEmail,
        UserAttributes: [
          { Name: 'email', Value: cleanEmail },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: fullName.trim() },
        ],
        MessageAction: 'SUPPRESS',
      })
    )

    // 2. Set permanent password
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: cleanEmail,
        Password: password,
        Permanent: true,
      })
    )

    // 3. Immediately authenticate to generate tokens
    const authRes = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
          USERNAME: cleanEmail,
          PASSWORD: password,
        },
      })
    )

    const result = authRes.AuthenticationResult
    if (!result?.IdToken || !result?.AccessToken) {
      return { success: false, error: 'Authentication challenge required' }
    }

    return {
      success: true,
      tokens: {
        idToken: result.IdToken,
        accessToken: result.AccessToken,
        refreshToken: result.RefreshToken,
        expiresIn: result.ExpiresIn,
      },
      user: {
        id: cleanEmail,
        email: cleanEmail,
        name: fullName,
        role: 'Underwriter',
      },
    }
  } catch (err: any) {
    if (err.name === 'UsernameExistsException') {
      return { success: false, error: 'An account with this email already exists. Please sign in.' }
    }
    if (err.name === 'InvalidPasswordException') {
      return { success: false, error: 'Password must be at least 8 characters long and contain numbers and lowercase letters.' }
    }
    return { success: false, error: err.message || 'Cognito registration failed' }
  }
}

/**
 * Authenticates an underwriter against AWS Cognito User Pool
 */
export async function signInCognitoUser(
  email: string,
  password: string
): Promise<{ success: boolean; tokens?: AuthTokens; user?: AuthUser; error?: string }> {
  const client = getClient()
  const cleanEmail = email.trim().toLowerCase()

  try {
    const authRes = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
          USERNAME: cleanEmail,
          PASSWORD: password,
        },
      })
    )

    const result = authRes.AuthenticationResult
    if (!result?.IdToken || !result?.AccessToken) {
      return { success: false, error: 'Authentication challenge required' }
    }

    let fullName = cleanEmail
    try {
      const userDetails = await client.send(
        new AdminGetUserCommand({
          UserPoolId: userPoolId,
          Username: cleanEmail,
        })
      )
      const nameAttr = userDetails.UserAttributes?.find((a) => a.Name === 'name')
      if (nameAttr?.Value) fullName = nameAttr.Value
    } catch {}

    return {
      success: true,
      tokens: {
        idToken: result.IdToken,
        accessToken: result.AccessToken,
        refreshToken: result.RefreshToken,
        expiresIn: result.ExpiresIn,
      },
      user: {
        id: cleanEmail,
        email: cleanEmail,
        name: fullName,
        role: 'Underwriter',
      },
    }
  } catch (err: any) {
    if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
      return { success: false, error: 'Invalid email or password.' }
    }
    return { success: false, error: err.message || 'Authentication failed' }
  }
}
