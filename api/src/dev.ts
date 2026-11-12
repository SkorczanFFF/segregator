import { serve } from '@hono/node-server'
import { app } from './index.ts'

for (const name of ['TABLE_NAME', 'USER_POOL_ID', 'USER_POOL_CLIENT_ID']) {
  if (!process.env[name]) throw new Error(`${name} is missing in api/.env, see README.md`)
}

// Loopback only: this process acts with your own AWS credentials.
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3000 }, ({ port }) =>
  console.log(`API on http://127.0.0.1:${port}`),
)
