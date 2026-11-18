import { Hono } from 'hono'
import { DocumentInput, FileChoice, STORAGE_LIMIT, UploadInput, type ReadUse, type StorageUse } from 'shared'
import { deleteFiles, FILE_URL_SECONDS, fileUrl, ID_PATTERN, signUpload } from './document-files.ts'
import {
  chooseVersion,
  createDocument,
  createDraft,
  deleteDocument,
  DuplicateFile,
  findByHash,
  getDocument,
  listDocuments,
  markSent,
  storageUsed,
  updateDocument,
} from './document-table.ts'
import { apiError, duplicateError } from './errors.ts'
import { queueRead } from './read-jobs.ts'
import { readLimits } from './read-limits.ts'
import { finishRead, readUse, startRead } from './read-table.ts'
import type { Env } from './session.ts'
import { jsonBody } from './validate.ts'

export const documents = new Hono<Env>()

// Any other id falls through to the app's 404.
const BY_ID = `/:id{${ID_PATTERN}}`

documents.get('/', async (c) => {
  const page = await listDocuments(c.get('session').sub, c.req.query('cursor'))
  if (!page) return apiError(c, 'invalid_input', 400)
  return c.json(page)
})

documents.post('/', jsonBody(DocumentInput), async (c) =>
  c.json(await createDocument(c.get('session').sub, c.req.valid('json')), 201),
)

// A document from a file starts as a draft, so the file is processed while the person still looks at it.
// The file goes straight to S3, and the worker takes it from there. A file the account already has is
// turned away before it is sent, and so is one that doesn't fit in the account's storage.
documents.post('/upload', jsonBody(UploadInput), async (c) => {
  const sub = c.get('session').sub
  const { fileType, fileHash, fileSize } = c.req.valid('json')
  const existing = await findByHash(sub, fileHash)
  if (existing) return duplicateError(c, existing)
  if ((await storageUsed(sub)) + fileSize > STORAGE_LIMIT) return apiError(c, 'storage_full', 403)
  const draft = await createDraft(sub, fileHash, fileSize)
  return c.json(await signUpload(sub, draft.id, fileType, fileSize), 201)
})

documents.get('/storage', async (c) => c.json({ used: await storageUsed(c.get('session').sub) } satisfies StorageUse))

documents.get('/reads', async (c) => c.json((await readUse(c.get('session').sub, await readLimits())) satisfies ReadUse))

// Reads the document's file with the model in the background. The reading counts against the limits at once,
// and the document shows it under way until the reader is done.
documents.post(`${BY_ID}/read`, async (c) => {
  const sub = c.get('session').sub
  const id = c.req.param('id')
  const started = await startRead(sub, id, await readLimits())
  if (started === 'not_ready') return apiError(c, 'invalid_input', 400)
  if (started === 'read_limit' || started === 'read_unavailable') return apiError(c, started, 403)
  try {
    await queueRead({ sub, id, readId: started.readId })
  } catch (err) {
    // Without its message the reading would wait for nothing.
    await finishRead(sub, id, started.readId)
    throw err
  }
  return c.json(await getDocument(sub, id), 202)
})

// The browser has sent the file to S3.
documents.post(`${BY_ID}/sent`, async (c) => {
  await markSent(c.get('session').sub, c.req.param('id'))
  return c.body(null, 204)
})

documents.get(BY_ID, async (c) => {
  const doc = await getDocument(c.get('session').sub, c.req.param('id'))
  return doc ? c.json(doc) : apiError(c, 'not_found', 404)
})

// Sends the browser on to S3 with a short-lived address: to the file as sent, or with ?version=processed to
// the copy preprocessing made.
documents.get(`${BY_ID}/file`, async (c) => {
  const sub = c.get('session').sub
  const doc = await getDocument(sub, c.req.param('id'))
  if (!doc?.file) return apiError(c, 'not_found', 404)
  // The browser may reuse the redirect until shortly before the address expires.
  c.header('Cache-Control', `private, max-age=${FILE_URL_SECONDS - 60}`)
  return c.redirect(await fileUrl(sub, doc.id, c.req.query('version') === 'processed' ? 'processed' : 'raw'))
})

documents.put(`${BY_ID}/file`, jsonBody(FileChoice), async (c) => {
  const doc = await chooseVersion(c.get('session').sub, c.req.param('id'), c.req.valid('json').use)
  return doc ? c.json(doc) : apiError(c, 'not_found', 404)
})

documents.put(BY_ID, jsonBody(DocumentInput), async (c) => {
  try {
    const doc = await updateDocument(c.get('session').sub, c.req.param('id'), c.req.valid('json'))
    return doc ? c.json(doc) : apiError(c, 'not_found', 404)
  } catch (err) {
    // Another draft of the same file was saved first, e.g. in another tab.
    if (err instanceof DuplicateFile) return duplicateError(c, err.id)
    throw err
  }
})

documents.delete(BY_ID, async (c) => {
  const sub = c.get('session').sub
  const doc = await getDocument(sub, c.req.param('id'))
  if (!doc) return apiError(c, 'not_found', 404)
  // The files go first, so a failed delete can be repeated. A file that arrives later finds no document,
  // and the worker deletes it.
  await deleteFiles(sub, doc.id)
  await deleteDocument(sub, doc.id)
  return c.body(null, 204)
})
