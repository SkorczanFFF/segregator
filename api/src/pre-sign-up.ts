import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

// The part of Cognito's Pre sign-up event this trigger reads.
type PreSignUpEvent = { request: { userAttributes: Record<string, string | undefined> } }

const ssm = new SSMClient({})

// '*' lets anyone sign up; a comma-separated list of addresses lets in only those.
export function signUpAllowed(email: string, allowlist: string) {
  const entries = allowlist
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return entries.includes('*') || entries.includes(email.toLowerCase())
}

// Cognito calls this before it creates any account.
// It reads the list on every call, so a change applies at once.
export async function handler(event: PreSignUpEvent) {
  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: process.env.SIGNUP_ALLOWLIST }))
  if (!signUpAllowed(event.request.userAttributes.email ?? '', Parameter?.Value ?? '')) throw new Error('signup_closed')
  return event
}
