import { Hono } from 'hono'
import { DocumentInput } from 'shared'
import { createDocument, deleteDocument, getDocument, listDocuments, updateDocument } from './document-table.ts'
import type { Env } from './session.ts'
import { parse } from './validate.ts'

export const documents = new Hono<Env>()

// Matches ULIDs only; any other id falls through to the app's 404.
const BY_ID = '/:id{[0-9A-HJKMNP-TV-Z]{26}}'

// Keys start from the signed-in account, so another account's document is simply not found.
const notFound = { error: 'not_found' } as const

documents.get('/', async (c) => {
  const page = await listDocuments(c.get('session').sub, c.req.query('cursor'))
  if (!page) return c.json({ error: 'invalid_input' }, 400)
  return c.json(page)
})

documents.post('/', async (c) => {
  const input = await parse(c, DocumentInput)
  if (!input) return c.json({ error: 'invalid_input' }, 400)
  return c.json(await createDocument(c.get('session').sub, input), 201)
})

documents.get(BY_ID, async (c) => {
  const doc = await getDocument(c.get('session').sub, c.req.param('id'))
  return doc ? c.json(doc) : c.json(notFound, 404)
})

documents.put(BY_ID, async (c) => {
  const input = await parse(c, DocumentInput)
  if (!input) return c.json({ error: 'invalid_input' }, 400)
  const doc = await updateDocument(c.get('session').sub, c.req.param('id'), input)
  return doc ? c.json(doc) : c.json(notFound, 404)
})

documents.delete(BY_ID, async (c) => {
  const deleted = await deleteDocument(c.get('session').sub, c.req.param('id'))
  return deleted ? c.body(null, 204) : c.json(notFound, 404)
})
