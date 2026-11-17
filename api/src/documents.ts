import { Hono } from 'hono'
import { DocumentInput, FileChoice, UploadInput } from 'shared'
import { deleteFiles, FILE_URL_SECONDS, fileUrl, ID_PATTERN, signUpload } from './document-files.ts'
import {
  chooseVersion,
  createDocument,
  createDraft,
  deleteDocument,
  getDocument,
  listDocuments,
  markSent,
  updateDocument,
} from './document-table.ts'
import { apiError } from './errors.ts'
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
// The file goes straight to S3, and the worker takes it from there.
documents.post('/upload', jsonBody(UploadInput), async (c) => {
  const sub = c.get('session').sub
  const draft = await createDraft(sub)
  return c.json(await signUpload(sub, draft.id, c.req.valid('json').fileType), 201)
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
  const doc = await updateDocument(c.get('session').sub, c.req.param('id'), c.req.valid('json'))
  return doc ? c.json(doc) : apiError(c, 'not_found', 404)
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
