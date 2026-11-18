import { Hono } from 'hono'
import { handle } from '@hono/aws-lambda'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { account } from './account.ts'
import { auth } from './auth.ts'
import { documents } from './documents.ts'
import { apiError } from './errors.ts'
import { google } from './google.ts'
import { readSession, type Env } from './session.ts'

export const app = new Hono<Env>().basePath('/api')

// Every route needs a session unless it is listed here.
const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/auth/register',
  '/api/auth/confirm',
  '/api/auth/login',
  '/api/auth/resend-code',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/logout',
  '/api/auth/demo',
  '/api/auth/google',
  '/api/auth/google/callback',
])

// Rejects writes that a page on another site can send without CORS, such as a form post.
// Browsers mark those with Sec-Fetch-Site.
app.use(csrf())

app.use(async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next()
  const session = await readSession(c)
  if (!session) return apiError(c, 'unauthorized', 401)
  if (session.demo && c.req.method !== 'GET') return apiError(c, 'demo_read_only', 403)
  c.set('session', session)
  return next()
})

app.get('/health', (c) => c.json({ ok: true }))
app.route('/auth/google', google)
app.route('/auth', auth)
app.route('/documents', documents)
app.route('/account', account)

// The API answers with error codes; the web app translates them.
app.notFound((c) => apiError(c, 'not_found', 404))
app.onError((err, c) => {
  // Hono's own refusals: csrf() answers 403 and a body that isn't JSON 400.
  if (err instanceof HTTPException && err.status === 403) return apiError(c, 'forbidden', 403)
  if (err instanceof HTTPException && err.status === 400) return apiError(c, 'invalid_input', 400)
  console.error(err)
  return apiError(c, 'internal_error', 500)
})

export const handler = handle(app)
