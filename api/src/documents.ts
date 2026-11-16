import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { Hono } from 'hono'
import { DocumentInput, NewDocumentInput, UploadInput } from 'shared'
import { deleteFile, fileInfo, signUpload } from './document-files.ts'
import { createDocument, deleteDocument, getDocument, listDocuments, updateDocument } from './document-table.ts'
import type { Env } from './session.ts'
import { parse } from './validate.ts'

export const documents = new Hono<Env>()

// Matches ULIDs only; any other id falls through to the app's 404.
const BY_ID = '/:id{[0-9A-HJKMNP-TV-Z]{26}}'

// Keys start from the signed-in account, so another account's document is simply not found.
const notFound = { error: 'not_found' } as const

const invalidInput = { error: 'invalid_input' } as const

documents.get('/', async (c) => {
  const page = await listDocuments(c.get('session').sub, c.req.query('cursor'))
  if (!page) return c.json(invalidInput, 400)
  return c.json(page)
})

documents.post('/upload', async (c) => {
  const input = await parse(c, UploadInput)
  if (!input) return c.json(invalidInput, 400)
  return c.json(await signUpload(c.get('session').sub, input.type), 201)
})

documents.post('/', async (c) => {
  const input = await parse(c, NewDocumentInput)
  if (!input) return c.json(invalidInput, 400)
  const { fileId, ...fields } = input
  const sub = c.get('session').sub
  if (!fileId) return c.json(await createDocument(sub, fields), 201)

  // The browser has already sent the file, so S3 confirms it before the document points at it.
  const file = await fileInfo(sub, fileId)
  if (!file) return c.json(invalidInput, 400)
  try {
    return c.json(await createDocument(sub, fields, { id: fileId, ...file }), 201)
  } catch (err) {
    // The file already belongs to a document.
    if (err instanceof ConditionalCheckFailedException) return c.json(invalidInput, 400)
    throw err
  }
})

documents.get(BY_ID, async (c) => {
  const doc = await getDocument(c.get('session').sub, c.req.param('id'))
  return doc ? c.json(doc) : c.json(notFound, 404)
})

documents.put(BY_ID, async (c) => {
  const input = await parse(c, DocumentInput)
  if (!input) return c.json(invalidInput, 400)
  const doc = await updateDocument(c.get('session').sub, c.req.param('id'), input)
  return doc ? c.json(doc) : c.json(notFound, 404)
})

documents.delete(BY_ID, async (c) => {
  const sub = c.get('session').sub
  const doc = await getDocument(sub, c.req.param('id'))
  if (!doc) return c.json(notFound, 404)
  // The file goes first, so a failed delete can be repeated and never leaves a file without its document.
  if (doc.file) await deleteFile(sub, doc.id)
  await deleteDocument(sub, doc.id)
  return c.body(null, 204)
})
