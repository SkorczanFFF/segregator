import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { Hono } from 'hono'
import { DocumentInput, NewDocumentInput, UploadInput } from 'shared'
import { deleteFile, fileInfo, fileUrl, signUpload } from './document-files.ts'
import { createDocument, deleteDocument, getDocument, listDocuments, updateDocument } from './document-table.ts'
import { apiError } from './errors.ts'
import type { Env } from './session.ts'
import { jsonBody } from './validate.ts'

export const documents = new Hono<Env>()

// Matches ULIDs only; any other id falls through to the app's 404.
const BY_ID = '/:id{[0-9A-HJKMNP-TV-Z]{26}}'

documents.get('/', async (c) => {
  const page = await listDocuments(c.get('session').sub, c.req.query('cursor'))
  if (!page) return apiError(c, 'invalid_input', 400)
  return c.json(page)
})

documents.post('/upload', jsonBody(UploadInput), async (c) =>
  c.json(await signUpload(c.get('session').sub, c.req.valid('json').type), 201),
)

documents.post('/', jsonBody(NewDocumentInput), async (c) => {
  const { fileId, ...fields } = c.req.valid('json')
  const sub = c.get('session').sub
  if (!fileId) return c.json(await createDocument(sub, fields), 201)

  // The browser has already sent the file, so S3 confirms it before the document points at it.
  const file = await fileInfo(sub, fileId)
  if (!file) return apiError(c, 'invalid_input', 400)
  try {
    return c.json(await createDocument(sub, fields, { id: fileId, ...file }), 201)
  } catch (err) {
    // The file already belongs to a document.
    if (err instanceof ConditionalCheckFailedException) return apiError(c, 'invalid_input', 400)
    throw err
  }
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
  if (doc.file) await deleteFile(sub, doc.id)
  await deleteDocument(sub, doc.id)
  return c.body(null, 204)
})
