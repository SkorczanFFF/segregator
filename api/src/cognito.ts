import { createHmac } from 'node:crypto'
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  DescribeUserPoolClientCommand,
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

export async function resendCode(email: string) {
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

  // The token comes straight from Cognito over TLS, so it needs no signature check.
  // The API keeps its own session, so the Cognito tokens are dropped here.
  const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString())
  return { sub: String(claims.sub), email: String(claims.email) }
}
