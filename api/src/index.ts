import { Hono } from 'hono'
import { handle } from '@hono/aws-lambda'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { auth } from './auth.ts'
import { documents } from './documents.ts'
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
])

// Rejects writes that a page on another site can send without CORS, such as a form post.
// Browsers mark those with Sec-Fetch-Site; the SameSite=Strict cookie already stops most of them.
app.use(csrf())

app.use(async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next()
  const session = await readSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('session', session)
  return next()
})

app.get('/health', (c) => c.json({ ok: true }))
app.route('/auth', auth)
app.route('/documents', documents)

// The API answers with error codes; the web app translates them.
app.notFound((c) => c.json({ error: 'not_found' }, 404))
app.onError((err, c) => {
  if (err instanceof HTTPException && err.status === 403) return c.json({ error: 'forbidden' }, 403)
  console.error(err)
  return c.json({ error: 'internal_error' }, 500)
})

export const handler = handle(app)
