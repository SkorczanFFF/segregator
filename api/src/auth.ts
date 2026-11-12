import { Hono, type Context } from 'hono'
import * as z from 'zod'
import { confirmSignUp, logIn, resendCode, signUp } from './cognito.ts'
import { createSession, deleteSession, type Env } from './session.ts'

type ErrorCode = 'invalid_input' | 'invalid_credentials' | 'invalid_code' | 'code_expired' | 'weak_password'

const Email = z.string().trim().toLowerCase().pipe(z.email().max(254))
const RegisterInput = z.object({ email: Email, password: z.string().min(12).max(256) })
const LoginInput = z.object({ email: Email, password: z.string().min(1).max(256) })
const ConfirmInput = z.object({ email: Email, code: z.string().regex(/^\d{6}$/) })

// Cognito can return any of these from any call once a limit is hit.
const LIMIT_ERRORS = new Set([
  'TooManyRequestsException',
  'LimitExceededException',
  'TooManyFailedAttemptsException',
])

const errorName = (err: unknown) => (err instanceof Error ? err.name : '')

async function parse<T extends z.ZodType>(c: Context, schema: T) {
  const result = schema.safeParse(await c.req.json().catch(() => undefined))
  return result.success ? result.data : undefined
}

// Turns the Cognito errors a route expects into API error codes. Anything else ends as a 500.
function fail(c: Context, err: unknown, expected: Record<string, ErrorCode>) {
  const name = errorName(err)
  if (LIMIT_ERRORS.has(name)) return c.json({ error: 'too_many_requests' }, 429)
  const code = expected[name]
  if (!code) throw err
  return c.json({ error: code }, 400)
}

export const auth = new Hono<Env>()

auth.post('/register', async (c) => {
  const input = await parse(c, RegisterInput)
  if (!input) return c.json({ error: 'invalid_input' }, 400)

  try {
    await signUp(input.email, input.password)
  } catch (err) {
    if (errorName(err) !== 'UsernameExistsException') {
      return fail(c, err, {
        InvalidPasswordException: 'weak_password',
        InvalidParameterException: 'invalid_input',
      })
    }
    // Cognito reveals taken addresses on sign-up, so the API answers as for a new account.
    // An unconfirmed account gets a new code, a confirmed one gets nothing.
    await resendCode(input.email).catch(() => undefined)
  }
  return c.body(null, 204)
})

auth.post('/confirm', async (c) => {
  const input = await parse(c, ConfirmInput)
  if (!input) return c.json({ error: 'invalid_input' }, 400)

  try {
    await confirmSignUp(input.email, input.code)
  } catch (err) {
    // Unknown and already confirmed accounts look like a wrong code.
    return fail(c, err, {
      CodeMismatchException: 'invalid_code',
      NotAuthorizedException: 'invalid_code',
      UserNotFoundException: 'invalid_code',
      ExpiredCodeException: 'code_expired',
    })
  }
  return c.body(null, 204)
})

auth.post('/login', async (c) => {
  const input = await parse(c, LoginInput)
  if (!input) return c.json({ error: 'invalid_input' }, 400)

  let user
  try {
    user = await logIn(input.email, input.password)
  } catch (err) {
    if (errorName(err) === 'UserNotConfirmedException') {
      // A fresh code lets the user finish a sign-up whose code has expired.
      await resendCode(input.email).catch(() => undefined)
      return c.json({ error: 'not_confirmed' }, 400)
    }
    return fail(c, err, { NotAuthorizedException: 'invalid_credentials' })
  }
  // Always a new session, so a session id planted before sign-in never gets access.
  await createSession(c, user)
  return c.json({ email: user.email })
})

auth.post('/logout', async (c) => {
  await deleteSession(c)
  return c.body(null, 204)
})

auth.get('/me', (c) => c.json({ email: c.get('session').email }))
