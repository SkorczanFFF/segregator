import { createHash, randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { cognitoSignOutUrl, exchangeCode, googleSignInUrl } from './cognito.ts'
import { createSession, type Env } from './session.ts'

const COOKIE = 'google'
const CALLBACK = `${process.env.APP_URL}/api/auth/google/callback`
const AFTER_SIGN_IN = `${process.env.APP_URL}/documents`
// Lax, because Strict cookies are not sent on the redirect back from Google and Cognito.
const COOKIE_OPTIONS = { prefix: 'host', httpOnly: true, sameSite: 'Lax' } as const

const random = () => randomBytes(32).toString('base64url')

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

  if (!state || !verifier || c.req.query('state') !== state) return c.redirect('/login?error=google_failed')
  // The Pre sign-up trigger's message reaches this page inside Cognito's error description.
  if (error_description?.includes('signup_closed')) return c.redirect('/login?error=signup_closed')
  if (!code) return c.redirect('/login?error=google_failed')

  try {
    await createSession(c, await exchangeCode(code, verifier, CALLBACK))
  } catch (err) {
    console.error(err)
    return c.redirect('/login?error=google_failed')
  }
  // Cognito keeps a session of its own, which would skip Google on the next sign-in in this browser,
  // even after signing out of the app. The app has its own session, so Cognito's ends right away.
  return c.redirect(cognitoSignOutUrl(AFTER_SIGN_IN))
})
