import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { DocumentInput } from 'shared'
import type { CheckResult } from './document-table.ts'
import { setUpLocalTable } from './local-table.ts'

setUpLocalTable('documents-test')

const {
  chooseVersion,
  claimDocument,
  createDocument,
  createDraft,
  deleteDocument,
  getDocument,
  listDocuments,
  markSent,
  settleDocument,
  updateDocument,
} = await import('./document-table.ts')

// A saved document, or undefined for a draft or no document.
const saved = async (sub: string, id: string) => {
  const found = await getDocument(sub, id)
  return found?.draft ? undefined : found
}

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
  assert.equal((await saved(owner, id))?.docDate, '2026-11-10')
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
  const stored = await saved(sub, created.id)
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

type CheckedFile = Extract<CheckResult, { status: 'done' }>['file']

// A draft whose file the worker checked, as one message would leave it.
async function checkedDraft(sub: string, file: CheckedFile = { type: 'image/jpeg', size: 99, pages: 1 }) {
  const { id } = await createDraft(sub)
  await claimDocument(sub, id, 'message')
  await settleDocument(sub, id, 'message', { status: 'done', file })
  return id
}

test('keeps a draft off the list until its checked file gets fields', async (t) => {
  const sub = randomUUID()
  const { id, draft, status } = await createDraft(sub)
  assert.equal(draft, true)
  assert.equal(status, 'uploading')
  assert.equal((await getDocument(sub, id))?.draft, true)
  assert.equal(await updateDocument(sub, id, doc('2026-11-17')), undefined, 'a file not checked yet')

  await claimDocument(sub, id, 'message')
  await settleDocument(sub, id, 'message', { status: 'done', file: { type: 'image/jpeg', size: 99, pages: 1 } })
  assert.equal((await listDocuments(sub))?.items.length, 0)
  const filled = await updateDocument(sub, id, doc('2026-11-17'))
  assert.equal(filled?.draft, undefined)
  assert.equal((await listDocuments(sub))?.items[0]?.id, id)

  // Saved, it no longer expires.
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 25 * 60 * 60 * 1000 })
  assert.equal((await saved(sub, id))?.issuer, 'Sklep spożywczy')
})

test('forgets a draft nobody saved after a day', async (t) => {
  const sub = randomUUID()
  const id = await checkedDraft(sub)
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 25 * 60 * 60 * 1000 })
  assert.equal(await getDocument(sub, id), undefined)
  assert.equal(await updateDocument(sub, id, doc('2026-11-17')), undefined, 'not brought back by a save')
})

test('lets one message at a time check a file, and the same message again on a retry', async () => {
  const sub = randomUUID()
  const { id } = await createDraft(sub)
  await markSent(sub, id)
  assert.equal((await getDocument(sub, id))?.status, 'processing', 'sent, before any message')

  assert.equal(await claimDocument(sub, id, 'first'), 'claimed')
  assert.equal(await claimDocument(sub, id, 'duplicate'), 'taken')
  assert.equal(await claimDocument(sub, id, 'first'), 'claimed', 'a retry of the same message')

  await settleDocument(sub, id, 'first', { status: 'failed' })
  await markSent(sub, id)
  assert.equal((await getDocument(sub, id))?.status, 'failed', 'a late report from the browser')
  assert.equal(await claimDocument(sub, id, 'sent again'), 'claimed', 'a failed file sent back from the dead-letter queue')
  const file = { type: 'application/pdf', size: 1234, pages: 2 } as const
  await settleDocument(sub, id, 'sent again', { status: 'done', file })
  assert.equal(await claimDocument(sub, id, 'late duplicate'), 'taken')

  const done = await getDocument(sub, id)
  assert.equal(done?.status, 'done')
  assert.deepEqual(done?.file, file)
})

test('keeps the status and the file through an edit', async () => {
  const sub = randomUUID()
  const id = await checkedDraft(sub)
  await updateDocument(sub, id, doc('2026-11-11'))
  await updateDocument(sub, id, doc('2026-11-11', { title: 'Zmieniony' }))

  const stored = await getDocument(sub, id)
  assert.equal(stored?.draft, undefined)
  assert.equal(stored?.status, 'done')
  assert.deepEqual(stored?.file, { type: 'image/jpeg', size: 99, pages: 1 })
})

test('keeps the chosen version of a photo that preprocessing changed', async () => {
  const sub = randomUUID()
  assert.equal(await chooseVersion(sub, await checkedDraft(sub), 'raw'), undefined, 'a photo left as it was')

  const id = await checkedDraft(sub, { type: 'image/jpeg', size: 99, pages: 1, change: 'cut' })
  assert.equal(await updateDocument(sub, id, doc('2026-11-17')), undefined, 'saved before a version is chosen')
  const chosen = await chooseVersion(sub, id, 'raw')
  assert.deepEqual(chosen?.file, { type: 'image/jpeg', size: 99, pages: 1, change: 'cut', use: 'raw' })
  assert.equal((await updateDocument(sub, id, doc('2026-11-17')))?.draft, undefined)
})

test('leaves a document deleted while its file was being checked', async () => {
  const sub = randomUUID()
  const { id } = await createDraft(sub)
  await claimDocument(sub, id, 'message')
  await deleteDocument(sub, id)

  await settleDocument(sub, id, 'message', { status: 'failed' })
  assert.equal(await getDocument(sub, id), undefined)
  assert.equal(await claimDocument(sub, id, 'late file'), 'gone')
})
