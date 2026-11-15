import {
  AdminLinkProviderForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

// The part of Cognito's Pre sign-up event this trigger reads.
type PreSignUpEvent = {
  triggerSource: string
  userPoolId: string
  // On a first Google sign-in: the provider name and the person's Google id, e.g. Google_1234.
  userName: string
  request: { userAttributes: Record<string, string | undefined> }
}

const ssm = new SSMClient({})
const cognito = new CognitoIdentityProviderClient({})

// '*' lets anyone sign up; a comma-separated list of addresses lets in only those.
export function signUpAllowed(email: string, allowlist: string) {
  const entries = allowlist
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return entries.includes('*') || entries.includes(email.toLowerCase())
}

async function usersWithEmail(userPoolId: string, email: string) {
  const value = email.replace(/["\\]/g, '\\$&')
  const { Users } = await cognito.send(new ListUsersCommand({ UserPoolId: userPoolId, Filter: `email = "${value}"` }))
  return Users ?? []
}

// Cognito calls this before it creates any account.
// It reads the list on every call, so a change applies at once.
export async function handler(event: PreSignUpEvent) {
  const { email = '', email_verified } = event.request.userAttributes
  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: process.env.SIGNUP_ALLOWLIST }))
  if (!signUpAllowed(email, Parameter?.Value ?? '')) throw new Error('signup_closed')

  const users = await usersWithEmail(event.userPoolId, email)
  if (event.triggerSource === 'PreSignUp_ExternalProvider') {
    // Google joins the account that confirmed this address with a code, so both ways lead to the same data.
    // An unconfirmed account may belong to whoever typed someone else's address, so it stays apart.
    const account = users.find((user) => user.UserStatus === 'CONFIRMED')
    if (account && email_verified === 'true') {
      await cognito.send(
        new AdminLinkProviderForUserCommand({
          UserPoolId: event.userPoolId,
          DestinationUser: { ProviderName: 'Cognito', ProviderAttributeValue: account.Username },
          SourceUser: {
            ProviderName: 'Google',
            ProviderAttributeName: 'Cognito_Subject',
            ProviderAttributeValue: event.userName.slice(event.userName.indexOf('_') + 1),
          },
        }),
      )
    }
  } else if (users.some((user) => user.UserStatus === 'EXTERNAL_PROVIDER')) {
    // An account that came from Google can't get a password, so a sign-up with its address is turned away.
    throw new Error('account_exists')
  }
  return event
}
