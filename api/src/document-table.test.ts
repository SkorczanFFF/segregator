import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import type { DocumentInput } from 'shared'
import { ulid } from 'ulid'
import { setUpLocalTable } from './local-table.ts'

setUpLocalTable('documents-test')

const { createDocument, deleteDocument, getDocument, listDocuments, updateDocument } = await import('./document-table.ts')

const doc = (docDate: string, extra: Partial<DocumentInput> = {}): DocumentInput => ({
  type: 'receipt',
  issuer: 'Sklep spożywczy',
  docDate,
  ...extra,
})

test('lists documents newest first by the date on the document', async () => {
  const sub = randomUUID()
  for (const date of ['2026-01-02', '2026-03-01', '2025-12-31']) await createDocument(sub, doc(date))

  const page = await listDocuments(sub)
  assert.deepEqual(
    page?.items.map((item) => item.docDate),
    ['2026-03-01', '2026-01-02', '2025-12-31'],
  )
  assert.equal(page?.cursor, undefined)
})

test("never reaches another account's documents", async () => {
  const [owner, other] = [randomUUID(), randomUUID()]
  const { id } = await createDocument(owner, doc('2026-11-10'))

  assert.equal((await listDocuments(other))?.items.length, 0)
  assert.equal(await getDocument(other, id), undefined)
  assert.equal(await updateDocument(other, id, doc('2026-11-11')), undefined)
  await deleteDocument(other, id)
  assert.equal((await getDocument(owner, id))?.docDate, '2026-11-10')
})

test('pages with a cursor that only works for its own account', async () => {
  const [owner, other] = [randomUUID(), randomUUID()]
  await Promise.all(Array.from({ length: 53 }, () => createDocument(owner, doc('2026-01-01'))))

  const first = await listDocuments(owner)
  assert.equal(first?.items.length, 50)
  assert.ok(first?.cursor)
  const second = await listDocuments(owner, first.cursor)
  assert.equal(second?.items.length, 3)
  assert.equal(second?.cursor, undefined)
  assert.equal(await listDocuments(other, first.cursor), undefined)
  assert.equal(await listDocuments(owner, 'not-a-cursor'), undefined)
})

test('updates what a person entered and keeps the id and creation time', async () => {
  const sub = randomUUID()
  const created = await createDocument(sub, doc('2026-11-10', { title: 'Zakupy', amount: 4599 }))
  await createDocument(sub, doc('2026-11-05'))

  const updated = await updateDocument(sub, created.id, doc('2026-11-01', { amount: 5000 }))
  assert.equal(updated?.createdAt, created.createdAt)
  const stored = await getDocument(sub, created.id)
  assert.equal(stored?.title, undefined)
  assert.equal(stored?.amount, 5000)
  assert.equal((await listDocuments(sub))?.items.at(-1)?.id, created.id)
})

test('does not bring back a document deleted while it was being updated', async (t) => {
  const sub = randomUUID()
  const created = await createDocument(sub, doc('2026-11-10'))
  // The delete lands right after the update has read the document.
  const send = DynamoDBClient.prototype.send as (this: DynamoDBClient, command: object) => Promise<unknown>
  t.mock.method(DynamoDBClient.prototype, 'send', async function (this: DynamoDBClient, command: object) {
    const result = await send.call(this, command)
    if (command instanceof GetItemCommand) await deleteDocument(sub, created.id)
    return result
  })

  assert.equal(await updateDocument(sub, created.id, doc('2026-11-11')), undefined)
  t.mock.restoreAll()
  assert.equal(await getDocument(sub, created.id), undefined)
})

test('keeps the file through updates and gives it to one document only', async () => {
  const sub = randomUUID()
  const file = { id: ulid(), type: 'image/jpeg', size: 1234 } as const
  assert.equal((await createDocument(sub, doc('2026-11-10'), file)).id, file.id)

  await updateDocument(sub, file.id, doc('2026-11-11'))
  assert.deepEqual((await getDocument(sub, file.id))?.file, { type: 'image/jpeg', size: 1234 })
  await assert.rejects(createDocument(sub, doc('2026-11-12'), file), { name: 'ConditionalCheckFailedException' })

  await deleteDocument(sub, file.id)
  assert.equal(await getDocument(sub, file.id), undefined)
})
