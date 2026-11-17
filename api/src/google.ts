import { createHash, randomBytes } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { AFTER_SIGN_IN_PATH, GOOGLE_CALLBACK_PATH, type ErrorCode } from 'shared'
import { cognitoSignOutUrl, exchangeCode, googleSignInUrl } from './cognito.ts'
import { createSession, type Env } from './session.ts'
import { triggerErrorIn } from './trigger-errors.ts'

const COOKIE = 'google'
const CALLBACK = process.env.APP_URL + GOOGLE_CALLBACK_PATH
const AFTER_SIGN_IN = process.env.APP_URL + AFTER_SIGN_IN_PATH
// Lax, because Strict cookies are not sent on the redirect back from Google and Cognito.
const COOKIE_OPTIONS = { prefix: 'host', httpOnly: true, sameSite: 'Lax' } as const

const random = () => randomBytes(32).toString('base64url')

// The sign-in page shows the message for this code.
const backToSignIn = (c: Context, code: ErrorCode) => c.redirect(`/login?error=${code}`)

export const google = new Hono<Env>()

google.get('/', (c) => {
  // state ties the way back to this browser; the PKCE verifier makes a stolen code useless.
  const state = random()
  const verifier = random()
  setCookie(c, COOKIE, `${state}.${verifier}`, { ...COOKIE_OPTIONS, maxAge: 600 })
  return c.redirect(googleSignInUrl(state, createHash('sha256').update(verifier).digest('base64url'), CALLBACK))
})

google.get('/callback', async (c) => {
  const [state, verifier] = (getCookie(c, COOKIE, 'host') ?? '').split('.')
  deleteCookie(c, COOKIE, COOKIE_OPTIONS)
  const { code, error_description } = c.req.query()

  if (!state || !verifier || c.req.query('state') !== state) return backToSignIn(c, 'google_failed')
  // The Pre sign-up trigger's message reaches this page inside Cognito's error description.
  if (triggerErrorIn(error_description ?? '') === 'signup_closed') return backToSignIn(c, 'signup_closed')
  if (!code) return backToSignIn(c, 'google_failed')

  try {
    await createSession(c, await exchangeCode(code, verifier, CALLBACK))
  } catch (err) {
    console.error(err)
    return backToSignIn(c, 'google_failed')
  }
  // Cognito keeps a session of its own, which would skip Google on the next sign-in in this browser,
  // even after signing out of the app. The app has its own session, so Cognito's ends right away.
  return c.redirect(cognitoSignOutUrl(AFTER_SIGN_IN))
})
