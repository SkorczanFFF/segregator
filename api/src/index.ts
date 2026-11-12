import { Hono } from 'hono'
import { handle } from '@hono/aws-lambda'
import { auth } from './auth.ts'
import { readSession, type Env } from './session.ts'

export const app = new Hono<Env>().basePath('/api')

// Every route needs a session unless it is listed here.
const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/auth/register',
  '/api/auth/confirm',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/logout',
])

app.use(async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next()
  const session = await readSession(c)
  if (!session) return c.json({ error: 'unauthorized' }, 401)
  c.set('session', session)
  return next()
})

app.get('/health', (c) => c.json({ ok: true }))
app.route('/auth', auth)

// The API answers with error codes; the web app translates them.
app.notFound((c) => c.json({ error: 'not_found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal_error' }, 500)
})

export const handler = handle(app)
