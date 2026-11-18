import { Hono, type Context } from 'hono'
import { ConfirmInput, ForgotInput, LoginInput, RegisterInput, ResetInput, type ErrorCode, type User } from 'shared'
import {
  confirmSignUp,
  findUserSub,
  forgotPassword,
  logIn,
  resendCode,
  resetPassword,
  signUp,
} from './cognito.ts'
import { apiError } from './errors.ts'
import { createSession, DEMO, deleteAllSessions, deleteSession, type Env, type Session } from './session.ts'
import { triggerErrorIn } from './trigger-errors.ts'
import { jsonBody } from './validate.ts'

// What Cognito says about accounts that are unknown, unconfirmed or disabled.
const SILENT_FORGOT_ERRORS = new Set([
  'UserNotFoundException',
  'InvalidParameterException',
  'NotAuthorizedException',
])

// Cognito can return any of these from any call once a limit is hit.
const LIMIT_ERRORS = new Set([
  'TooManyRequestsException',
  'LimitExceededException',
  'TooManyFailedAttemptsException',
])

const errorName = (err: unknown) => (err instanceof Error ? err.name : '')

// The Pre sign-up trigger's message reaches the API inside Cognito's UserLambdaValidationException.
const triggerError = (err: unknown) =>
  errorName(err) === 'UserLambdaValidationException' ? triggerErrorIn((err as Error).message) : undefined

// Turns the Cognito errors a route expects into API error codes. Anything else ends as a 500.
function fail(c: Context, err: unknown, expected: Record<string, ErrorCode>) {
  const name = errorName(err)
  if (LIMIT_ERRORS.has(name)) return apiError(c, 'too_many_requests', 429)
  const code = expected[name]
  if (!code) throw err
  return apiError(c, code, 400)
}

export const auth = new Hono<Env>()

auth.post('/register', jsonBody(RegisterInput), async (c) => {
  const input = c.req.valid('json')
  try {
    await signUp(input.email, input.password)
  } catch (err) {
    const trigger = triggerError(err)
    if (trigger === 'signup_closed') return apiError(c, 'signup_closed', 400)
    // Cognito reveals taken addresses on sign-up, so the API answers as for a new account.
    // An address taken by a Google account counts too.
    if (errorName(err) !== 'UsernameExistsException' && trigger !== 'account_exists') {
      return fail(c, err, { InvalidPasswordException: 'weak_password', InvalidParameterException: 'invalid_input' })
    }
    // An unconfirmed account gets a new code, a confirmed or Google one gets nothing.
    await resendCode(input.email).catch(() => undefined)
  }
  return c.body(null, 204)
})

auth.post('/confirm', jsonBody(ConfirmInput), async (c) => {
  const input = c.req.valid('json')
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

auth.post('/login', jsonBody(LoginInput), async (c) => {
  const input = c.req.valid('json')
  let user
  try {
    user = await logIn(input.email, input.password)
  } catch (err) {
    if (errorName(err) === 'UserNotConfirmedException') {
      // A fresh code lets the user finish a sign-up whose code has expired.
      await resendCode(input.email).catch(() => undefined)
      return apiError(c, 'not_confirmed', 400)
    }
    return fail(c, err, { NotAuthorizedException: 'invalid_credentials' })
  }
  // Always a new session, so a session id planted before sign-in never gets access.
  await createSession(c, user)
  return c.json({ email: user.email } satisfies User)
})

auth.post('/resend-code', jsonBody(ForgotInput), async (c) => {
  const input = c.req.valid('json')
  try {
    await resendCode(input.email)
  } catch (err) {
    if (LIMIT_ERRORS.has(errorName(err))) return apiError(c, 'too_many_requests', 429)
    // Confirmed and unknown accounts get the same answer, so the screen does not reveal who has an account.
  }
  return c.body(null, 204)
})

auth.post('/forgot-password', jsonBody(ForgotInput), async (c) => {
  const input = c.req.valid('json')
  try {
    await forgotPassword(input.email)
  } catch (err) {
    const name = errorName(err)
    if (LIMIT_ERRORS.has(name)) return apiError(c, 'too_many_requests', 429)
    // Every address gets the same answer, so the form does not reveal who has an account.
    if (!SILENT_FORGOT_ERRORS.has(name)) throw err
  }
  return c.body(null, 204)
})

auth.post('/reset-password', jsonBody(ResetInput), async (c) => {
  const input = c.req.valid('json')
  try {
    await resetPassword(input.email, input.code, input.password)
  } catch (err) {
    // Unknown and unconfirmed accounts look like a wrong code.
    return fail(c, err, {
      CodeMismatchException: 'invalid_code',
      UserNotFoundException: 'invalid_code',
      NotAuthorizedException: 'invalid_code',
      ExpiredCodeException: 'code_expired',
      InvalidPasswordException: 'weak_password',
      InvalidParameterException: 'invalid_input',
    })
  }
  // A new password ends every session, so whoever knew the old one is signed out too.
  await deleteAllSessions(await findUserSub(input.email))
  return c.body(null, 204)
})

auth.post('/logout', async (c) => {
  await deleteSession(c)
  return c.body(null, 204)
})

auth.post('/logout-all', async (c) => {
  await deleteAllSessions(c.get('session').sub)
  await deleteSession(c)
  return c.body(null, 204)
})

const userOf = ({ email, demo }: Session): User => ({ email, demo })

auth.post('/demo', async (c) => {
  await createSession(c, DEMO)
  return c.json(userOf(DEMO))
})

auth.get('/me', (c) => c.json(userOf(c.get('session'))))
