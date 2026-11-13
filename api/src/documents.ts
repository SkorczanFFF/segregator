import { Hono } from 'hono'
import { DocumentInput } from 'shared'
import { createDocument, listDocuments } from './document-table.ts'
import type { Env } from './session.ts'
import { parse } from './validate.ts'

export const documents = new Hono<Env>()

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
