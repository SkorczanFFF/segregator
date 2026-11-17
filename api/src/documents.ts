import { Hono } from 'hono'
import { DocumentInput, UploadInput } from 'shared'
import { deleteFile, fileUrl, ID_PATTERN, signUpload } from './document-files.ts'
import { createDocument, deleteDocument, getDocument, listDocuments, updateDocument } from './document-table.ts'
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

// The document comes first, so it stays even when the tab closes right after the file is sent.
// Its file goes straight to S3, and the worker takes it from there.
documents.post('/upload', jsonBody(UploadInput), async (c) => {
  const { fileType, ...fields } = c.req.valid('json')
  const sub = c.get('session').sub
  const doc = await createDocument(sub, fields, true)
  return c.json(await signUpload(sub, doc.id, fileType), 201)
})

documents.get(BY_ID, async (c) => {
  const doc = await getDocument(c.get('session').sub, c.req.param('id'))
  return doc ? c.json(doc) : apiError(c, 'not_found', 404)
})

// Sends the browser on to S3 with an address that works for five minutes.
documents.get(`${BY_ID}/file`, async (c) => {
  const sub = c.get('session').sub
  const doc = await getDocument(sub, c.req.param('id'))
  if (!doc?.file) return apiError(c, 'not_found', 404)
  // The browser may reuse the redirect until shortly before the address expires.
  c.header('Cache-Control', 'private, max-age=240')
  return c.redirect(await fileUrl(sub, doc.id))
})

documents.put(BY_ID, jsonBody(DocumentInput), async (c) => {
  const doc = await updateDocument(c.get('session').sub, c.req.param('id'), c.req.valid('json'))
  return doc ? c.json(doc) : apiError(c, 'not_found', 404)
})

documents.delete(BY_ID, async (c) => {
  const sub = c.get('session').sub
  const doc = await getDocument(sub, c.req.param('id'))
  if (!doc) return apiError(c, 'not_found', 404)
  // The file goes first, so a failed delete can be repeated and never leaves a file without its document.
  // A document still in the worker's hands may have a file already, and S3 deletes a missing key without error.
  await deleteFile(sub, doc.id)
  await deleteDocument(sub, doc.id)
  return c.body(null, 204)
})
