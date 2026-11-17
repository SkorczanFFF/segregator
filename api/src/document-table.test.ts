import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { DocumentInput } from 'shared'
import { setUpLocalTable } from './local-table.ts'

setUpLocalTable('documents-test')

const { claimDocument, createDocument, deleteDocument, getDocument, listDocuments, settleDocument, updateDocument } =
  await import('./document-table.ts')

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

test('does not bring back a deleted document', async () => {
  const sub = randomUUID()
  const { id } = await createDocument(sub, doc('2026-11-10'))
  await deleteDocument(sub, id)

  assert.equal(await updateDocument(sub, id, doc('2026-11-11')), undefined)
  assert.equal(await getDocument(sub, id), undefined)
})

test('hides a document whose file never came', async (t) => {
  const sub = randomUUID()
  const { id, status } = await createDocument(sub, doc('2026-11-10'), true)
  assert.equal(status, 'uploading')
  assert.equal((await listDocuments(sub))?.items[0]?.id, id)

  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 16 * 60 * 1000 })
  assert.equal((await listDocuments(sub))?.items.length, 0)
  assert.equal(await getDocument(sub, id), undefined)
})

test('lets one message at a time check a file, and the same message again on a retry', async () => {
  const sub = randomUUID()
  const { id } = await createDocument(sub, doc('2026-11-10'), true)

  assert.equal(await claimDocument(sub, id, 'first'), true)
  assert.equal(await claimDocument(sub, id, 'duplicate'), false)
  assert.equal(await claimDocument(sub, id, 'first'), true, 'a retry of the same message')
  assert.equal((await getDocument(sub, id))?.status, 'processing')

  await settleDocument(sub, id, 'first', { status: 'failed' })
  assert.equal(await claimDocument(sub, id, 'sent again'), true, 'a failed file sent back from the dead-letter queue')
  const file = { type: 'application/pdf', size: 1234, pages: 2 } as const
  await settleDocument(sub, id, 'sent again', { status: 'done', file })
  assert.equal(await claimDocument(sub, id, 'late duplicate'), false)

  const done = await getDocument(sub, id)
  assert.equal(done?.status, 'done')
  assert.deepEqual(done?.file, file)
})

test('keeps the status and the file through an edit', async () => {
  const sub = randomUUID()
  const { id } = await createDocument(sub, doc('2026-11-10'), true)
  await claimDocument(sub, id, 'message')
  await updateDocument(sub, id, doc('2026-11-11', { title: 'Zmieniony' }))
  await settleDocument(sub, id, 'message', { status: 'done', file: { type: 'image/jpeg', size: 99, pages: 1 } })

  const stored = await getDocument(sub, id)
  assert.equal(stored?.title, 'Zmieniony')
  assert.equal(stored?.status, 'done')
  assert.equal(stored?.file?.size, 99)
})

test('leaves a document deleted while its file was being checked', async () => {
  const sub = randomUUID()
  const { id } = await createDocument(sub, doc('2026-11-10'), true)
  await claimDocument(sub, id, 'message')
  await deleteDocument(sub, id)

  await settleDocument(sub, id, 'message', { status: 'failed' })
  assert.equal(await getDocument(sub, id), undefined)
})
