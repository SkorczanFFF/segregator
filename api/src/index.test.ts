import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { Hono } from 'hono'
import { setUpLocalTable } from './local-table.ts'

setUpLocalTable('api-test')

const { app } = await import('./index.ts')
const { createSession } = await import('./session.ts')

// Starts a session through the real session code and returns the cookie a browser would send back.
async function signIn() {
  const sub = randomUUID()
  const issuer = new Hono().post('/', async (c) => {
    await createSession(c, { sub, email: `${sub}@example.com` })
    return c.body(null, 204)
  })
  const response = await issuer.request('/', { method: 'POST' })
  return response.headers.get('set-cookie')?.split(';')[0] ?? ''
}

const json = (cookie: string) => ({ Cookie: cookie, 'Content-Type': 'application/json' })

test('answers 401 without a valid session', async () => {
  for (const path of ['/api/documents', '/api/auth/me']) {
    assert.equal((await app.request(path)).status, 401)
    assert.equal((await app.request(path, { headers: { Cookie: '__Host-session=made-up' } })).status, 401)
  }
})

test('rejects a form post from another site, even with a session cookie', async () => {
  const headers = {
    Cookie: await signIn(),
    // A form can send JSON as text/plain, which needs no CORS preflight.
    'Content-Type': 'text/plain',
    Origin: 'https://attacker.example',
    'Sec-Fetch-Site': 'cross-site',
  }
  const body = JSON.stringify({ email: 'someone@example.com', password: 'a password' })
  for (const path of ['/api/auth/login', '/api/documents']) {
    assert.equal((await app.request(path, { method: 'POST', headers, body })).status, 403, path)
  }
})

test("answers 404 for another account's document", async () => {
  const [owner, other] = [await signIn(), await signIn()]
  const input = JSON.stringify({ type: 'invoice', issuer: 'Hurtownia', docDate: '2026-11-15' })

  const created = await app.request('/api/documents', { method: 'POST', headers: json(owner), body: input })
  assert.equal(created.status, 201)
  const { id } = (await created.json()) as { id: string }

  for (const method of ['GET', 'PUT', 'DELETE']) {
    const body = method === 'PUT' ? input : undefined
    assert.equal((await app.request(`/api/documents/${id}`, { method, headers: json(other), body })).status, 404, method)
  }
  assert.equal((await app.request(`/api/documents/${id}`, { headers: json(owner) })).status, 200)
})
