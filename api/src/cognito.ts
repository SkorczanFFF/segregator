import { createHmac } from 'node:crypto'
import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  DescribeUserPoolClientCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import type { Session } from './session.ts'

const cognito = new CognitoIdentityProviderClient({})
const USER_POOL_ID = process.env.USER_POOL_ID
const CLIENT_ID = process.env.USER_POOL_CLIENT_ID

// Read from Cognito once per cold start, so the secret is never copied into config.
let clientSecret: Promise<string> | undefined

function getClientSecret() {
  clientSecret ??= cognito
    .send(new DescribeUserPoolClientCommand({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID }))
    .then(({ UserPoolClient }) => {
      if (!UserPoolClient?.ClientSecret) throw new Error('User pool client has no secret')
      return UserPoolClient.ClientSecret
    })
    .catch((err: unknown) => {
      clientSecret = undefined
      throw err
    })
  return clientSecret
}

// A client with a secret has to sign every call made for a user.
async function secretHash(email: string) {
  return createHmac('sha256', await getClientSecret())
    .update(email + CLIENT_ID)
    .digest('base64')
}

export async function signUp(email: string, password: string) {
  await cognito.send(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: await secretHash(email),
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    }),
  )
}

// Cognito also sends a code to a confirmed account, where it can't be used, so only an unconfirmed one gets it.
export async function resendCode(email: string) {
  const { UserStatus } = await cognito.send(new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }))
  if (UserStatus !== 'UNCONFIRMED') return
  await cognito.send(
    new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      SecretHash: await secretHash(email),
      Username: email,
    }),
  )
}

export async function confirmSignUp(email: string, code: string) {
  await cognito.send(
    new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: await secretHash(email),
      Username: email,
      ConfirmationCode: code,
    }),
  )
}

export async function forgotPassword(email: string) {
  await cognito.send(
    new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      SecretHash: await secretHash(email),
      Username: email,
    }),
  )
}

export async function resetPassword(email: string, code: string, password: string) {
  await cognito.send(
    new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      SecretHash: await secretHash(email),
      Username: email,
      ConfirmationCode: code,
      Password: password,
    }),
  )
}

export async function logIn(email: string, password: string): Promise<Session> {
  const { AuthenticationResult } = await cognito.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: email, PASSWORD: password, SECRET_HASH: await secretHash(email) },
    }),
  )
  // The pool has no MFA or forced password change, so any challenge is unexpected.
  const idToken = AuthenticationResult?.IdToken
  if (!idToken) throw new Error('Unexpected sign-in challenge')
  return sessionFrom(idToken)
}

// Cognito's sign-in page skips straight to Google when it is named as the provider.
export function googleSignInUrl(state: string, challenge: string, redirectUri: string) {
  const url = new URL('/oauth2/authorize', process.env.COGNITO_DOMAIN)
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    identity_provider: 'Google',
    scope: 'openid email',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString()
  return url.toString()
}

// Ends Cognito's own session in this browser and sends it on to logoutUri.
export function cognitoSignOutUrl(logoutUri: string) {
  const url = new URL('/logout', process.env.COGNITO_DOMAIN)
  url.search = new URLSearchParams({ client_id: CLIENT_ID ?? '', logout_uri: logoutUri }).toString()
  return url.toString()
}

// Trades the code from a Google sign-in for tokens at Cognito's token endpoint.
export async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<Session> {
  const response = await fetch(new URL('/oauth2/token', process.env.COGNITO_DOMAIN), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${await getClientSecret()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })
  if (!response.ok) throw new Error(`Cognito token endpoint answered ${response.status}`)
  const { id_token } = (await response.json()) as { id_token: string }
  return sessionFrom(id_token)
}

// The token comes straight from Cognito over TLS, so it needs no signature check.
// The API keeps its own session, so the Cognito tokens are dropped here.
function sessionFrom(idToken: string): Session {
  const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString())
  return { sub: String(claims.sub), email: String(claims.email) }
}

// Only the admin API finds a user by address without that user's own tokens.
export async function findUserSub(email: string) {
  const { UserAttributes } = await cognito.send(new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }))
  const sub = UserAttributes?.find((attribute) => attribute.Name === 'sub')?.Value
  if (!sub) throw new Error('Cognito user has no sub')
  return sub
}
