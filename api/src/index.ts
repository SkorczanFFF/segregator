import { Hono } from 'hono'
import { handle } from '@hono/aws-lambda'

const app = new Hono().basePath('/api')

app.get('/health', (c) => c.json({ ok: true }))

// The API answers with error codes; the web app translates them.
app.notFound((c) => c.json({ error: 'not_found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'internal_error' }, 500)
})

export const handler = handle(app)
