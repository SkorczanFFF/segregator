import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import { SQSClient } from '@aws-sdk/client-sqs'
import { SSMClient } from '@aws-sdk/client-ssm'
import { Hono } from 'hono'
import { STORAGE_LIMIT, type Draft, type ReadUse, type StorageUse, type Upload } from 'shared'
import { fakeS3 } from './fake-s3.ts'
import { randomHash, setUpLocalTable } from './local-table.ts'

setUpLocalTable('api-test')
process.env.COGNITO_DOMAIN = 'https://auth.example.com'
process.env.APP_URL = 'https://app.example.com'

const { app } = await import('./index.ts')
const { createSession } = await import('./session.ts')
const { claimDocument, createDraft, finishRead, settleDocument } = await import('./document-table.ts')

// Starts a session through the real session code and returns the cookie a browser would send back.
async function signIn(sub = randomUUID()) {
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

test('answers invalid_input to a body that is not valid JSON', async () => {
  const response = await app.request('/api/auth/login', { method: 'POST', headers: json(''), body: '{' })
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'invalid_input' })
})

test('lets only a six-digit code through to Cognito', async (t) => {
  const send = t.mock.method(CognitoIdentityProviderClient.prototype, 'send', async () => {
    throw Object.assign(new Error('Wrong code'), { name: 'CodeMismatchException' })
  })
  const confirm = async (code: string) => {
    const body = JSON.stringify({ email: 'someone@example.com', code })
    const response = await app.request('/api/auth/confirm', { method: 'POST', headers: json(''), body })
    return ((await response.json()) as { error: string }).error
  }

  for (const code of ['dddddd', '12345', '1234567']) assert.equal(await confirm(code), 'invalid_input', code)
  assert.equal(send.mock.callCount(), 0)
  assert.equal(await confirm('123456'), 'invalid_code')
})

test('sends a Google sign-in through Cognito with PKCE and a state cookie', async () => {
  const response = await app.request('/api/auth/google')
  assert.equal(response.status, 302)
  const location = new URL(response.headers.get('location') ?? '')
  assert.equal(location.origin + location.pathname, 'https://auth.example.com/oauth2/authorize')
  assert.equal(location.searchParams.get('identity_provider'), 'Google')
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(location.searchParams.get('redirect_uri'), 'https://app.example.com/api/auth/google/callback')

  const cookie = response.headers.get('set-cookie') ?? ''
  assert.match(cookie, /SameSite=Lax/)
  assert.equal(cookie.match(/^__Host-google=([^.;]+)\./)?.[1], location.searchParams.get('state'))
})

test('signs in through the Google callback only when state matches the cookie', async (t) => {
  // Stand-ins for Cognito: the client secret and the token endpoint.
  t.mock.method(CognitoIdentityProviderClient.prototype, 'send', async () => ({ UserPoolClient: { ClientSecret: 'secret' } }))
  const claims = Buffer.from(JSON.stringify({ sub: randomUUID(), email: 'someone@example.com' })).toString('base64url')
  t.mock.method(globalThis, 'fetch', async () => Response.json({ id_token: `header.${claims}.signature` }))

  const callback = (state: string) =>
    app.request(`/api/auth/google/callback?code=a-code&state=${state}`, {
      headers: { Cookie: '__Host-google=expected.verifier' },
    })
  assert.equal((await callback('other')).headers.get('location'), '/login?error=google_failed')
  const response = await callback('expected')
  assert.match(response.headers.get('set-cookie') ?? '', /__Host-session=/)
  // On the way to the documents list the browser ends Cognito's own session.
  const location = new URL(response.headers.get('location') ?? '')
  assert.equal(location.origin + location.pathname, 'https://auth.example.com/logout')
  assert.equal(location.searchParams.get('logout_uri'), 'https://app.example.com/documents')
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

test("signs an upload only into the account's own folder, with the type and size limits", async () => {
  const sub = randomUUID()
  const cookie = await signIn(sub)
  const upload = (fileType: string, fileHash = randomHash(), fileSize = 2048) =>
    app.request('/api/documents/upload', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify({ fileType, fileHash, fileSize }),
    })

  assert.equal((await upload('image/svg+xml')).status, 400)
  assert.equal((await upload('image/png', 'not-a-hash')).status, 400)
  assert.equal((await upload('image/png', undefined, 11 * 1024 * 1024)).status, 400, 'over the file limit')
  const response = await upload('image/png')
  assert.equal(response.status, 201)
  const { id, fields } = (await response.json()) as Upload
  const conditions = Buffer.from(fields.Policy ?? '', 'base64').toString()
  for (const condition of [{ key: `raw/${sub}/${id}` }, { 'Content-Type': 'image/png' }, ['content-length-range', 1, 2048]]) {
    assert.ok(conditions.includes(JSON.stringify(condition)), JSON.stringify(condition))
  }
  // A draft waits for its file, and shows as processing once the browser reports the file sent.
  const draft = async () => (await (await app.request(`/api/documents/${id}`, { headers: json(cookie) })).json()) as Draft
  assert.deepEqual(await draft(), { id, createdAt: (await draft()).createdAt, status: 'uploading', draft: true })
  assert.equal((await app.request(`/api/documents/${id}/sent`, { method: 'POST', headers: json(cookie) })).status, 204)
  assert.equal((await draft()).status, 'processing')
})

test('turns away a file the account already has, pointing at its document', async () => {
  const sub = randomUUID()
  const cookie = await signIn(sub)
  const fileHash = randomHash()
  const upload = () =>
    app.request('/api/documents/upload', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify({ fileType: 'image/jpeg', fileHash, fileSize: 2048 }),
    })
  const { id } = (await (await upload()).json()) as Upload
  assert.equal((await upload()).status, 201, 'a draft holds no hash')

  await claimDocument(sub, id, 'message')
  await settleDocument(sub, id, 'message', { status: 'done', file: { type: 'image/jpeg', size: 2048, pages: 1 } })
  const fields = { type: 'receipt', issuer: 'Sklep', docDate: '2026-11-17' }
  const saved = await app.request(`/api/documents/${id}`, { method: 'PUT', headers: json(cookie), body: JSON.stringify(fields) })
  assert.equal(saved.status, 200)
  const again = await upload()
  assert.equal(again.status, 409)
  assert.deepEqual(await again.json(), { error: 'duplicate', id })
})

test('turns away a due date on a receipt', async () => {
  const cookie = await signIn()
  const create = (type: string) =>
    app.request('/api/documents', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify({ type, issuer: 'Sklep', docDate: '2026-11-12', dueDate: '2026-11-26' }),
    })
  assert.equal((await create('receipt')).status, 400)
  assert.equal((await create('invoice')).status, 201)
})

test('turns away a file that would not fit in the storage, and tells how much is used', async () => {
  const sub = randomUUID()
  const cookie = await signIn(sub)
  const upload = (fileSize: number) =>
    app.request('/api/documents/upload', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify({ fileType: 'image/jpeg', fileHash: randomHash(), fileSize }),
    })
  const storage = async () =>
    ((await (await app.request('/api/documents/storage', { headers: json(cookie) })).json()) as StorageUse).used
  assert.equal(await storage(), 0)

  await createDraft(sub, randomHash(), STORAGE_LIMIT - 1000)
  assert.equal(await storage(), STORAGE_LIMIT - 1000, 'a draft counts before its file arrives')
  const full = await upload(1001)
  assert.equal(full.status, 403)
  assert.deepEqual(await full.json(), { error: 'storage_full' })
  assert.equal((await upload(1000)).status, 201, 'a file that fits exactly')
  assert.equal((await upload(1)).status, 403, 'the space a signed upload takes')
})

test('shows both versions of a changed photo, keeps the chosen one and deletes both', async (t) => {
  const sub = randomUUID()
  const owner = await signIn(sub)
  const { id } = await createDraft(sub, randomHash(), 2048)
  const file = (cookie: string, query = '') => app.request(`/api/documents/${id}/file${query}`, { headers: json(cookie) })
  const choose = (cookie: string, use: string) =>
    app.request(`/api/documents/${id}/file`, { method: 'PUT', headers: json(cookie), body: JSON.stringify({ use }) })
  assert.equal((await file(owner)).status, 404, 'a file not checked yet')
  assert.equal((await choose(owner, 'raw')).status, 404, 'nothing to choose yet')

  await claimDocument(sub, id, 'message')
  const checked = { type: 'image/jpeg', size: 2048, pages: 1, change: 'cut' } as const
  await settleDocument(sub, id, 'message', { status: 'done', file: checked })
  for (const [query, version] of [['', 'raw'], ['?version=processed', 'processed']]) {
    const shown = await file(owner, query)
    assert.equal(shown.status, 302)
    const location = new URL(shown.headers.get('location') ?? '')
    assert.equal(location.pathname, `/${version}/${sub}/${id}`)
    assert.equal(location.searchParams.get('X-Amz-Expires'), '300')
  }
  const other = await signIn()
  assert.equal((await file(other)).status, 404, "another account's file")
  assert.equal((await choose(other, 'raw')).status, 404, "another account's photo")
  assert.equal((await choose(owner, 'cropped')).status, 400)
  const chosen = await choose(owner, 'raw')
  assert.deepEqual(((await chosen.json()) as Draft).file, { ...checked, use: 'raw' })

  const sent = fakeS3(t)
  assert.equal((await app.request(`/api/documents/${id}`, { method: 'DELETE', headers: json(owner) })).status, 204)
  assert.deepEqual(sent.toSorted(), [`DeleteObjectCommand processed/${sub}/${id}`, `DeleteObjectCommand raw/${sub}/${id}`])
})

test('starts a reading of a checked photo within the limits, and shows how many are left', async (t) => {
  t.mock.method(SSMClient.prototype, 'send', async () => ({ Parameter: { Value: '{"account":1,"app":1000000}' } }))
  const queued: string[] = []
  t.mock.method(SQSClient.prototype, 'send', async (command: { input: { MessageBody: string } }) => {
    queued.push(command.input.MessageBody)
    return {}
  })
  const sub = randomUUID()
  const cookie = await signIn(sub)
  const { id } = await createDraft(sub, randomHash(), 2048)
  const read = () => app.request(`/api/documents/${id}/read`, { method: 'POST', headers: json(cookie) })
  const reads = async () => (await (await app.request('/api/documents/reads', { headers: json(cookie) })).json()) as ReadUse
  assert.equal((await read()).status, 400, 'a file not checked yet')

  await claimDocument(sub, id, 'message')
  await settleDocument(sub, id, 'message', { status: 'done', file: { type: 'image/jpeg', size: 2048, pages: 1 } })
  const started = await read()
  assert.equal(started.status, 202)
  const { read: reading } = (await started.json()) as Draft
  assert.equal(reading?.status, 'reading')
  assert.deepEqual(queued.map((body) => JSON.parse(body)), [{ sub, id, readId: reading?.id }])
  assert.deepEqual(await reads(), { used: 1, limit: 1, open: true })

  await finishRead(sub, id, reading?.id ?? '')
  const over = await read()
  assert.equal(over.status, 403)
  assert.deepEqual(await over.json(), { error: 'read_limit' })
})
