import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test, type TestContext } from 'node:test'
import { NoSuchKey, S3Client } from '@aws-sdk/client-s3'
import { setUpLocalTable } from './local-table.ts'

setUpLocalTable('worker-test')
process.env.DOCUMENTS_BUCKET = 'documents-test'
process.env.MAX_RECEIVES = '3'

const { handler } = await import('./worker.ts')
const { createDraft, getDocument } = await import('./document-table.ts')

// A PDF of empty pages. It has no cross-reference table, which pdf.js rebuilds.
function pdf(pages: number) {
  const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(' ')
  let body = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[${kids}]/Count ${pages}>>endobj\n`
  for (let i = 0; i < pages; i++) body += `${i + 3} 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n`
  return new TextEncoder().encode(`${body}trailer<</Root 1 0 R>>\n%%EOF`)
}

type FakeFile = { type: string; bytes: Uint8Array; metadata?: Record<string, string> }

// Stands in for S3 with these files, and returns the keys the worker read. Each read gets its own copy,
// as from S3, because pdf.js takes over the buffer it reads.
function fakeS3(t: TestContext, files: Record<string, FakeFile | Error>) {
  const reads: string[] = []
  t.mock.method(S3Client.prototype, 'send', async (command: { input: { Key: string } }) => {
    reads.push(command.input.Key)
    const file = files[command.input.Key]
    if (!file) throw new NoSuchKey({ message: 'No such key', $metadata: {} })
    if (file instanceof Error) throw file
    return {
      ContentType: file.type,
      Metadata: file.metadata ?? {},
      Body: { transformToByteArray: async () => file.bytes.slice() },
    }
  })
  return reads
}

// An SQS message carrying an S3 notification, as Lambda hands it to the worker.
const message = (body: object, messageId = randomUUID(), receiveCount = 1) => ({
  messageId,
  receiptHandle: 'handle',
  body: JSON.stringify(body),
  attributes: { ApproximateReceiveCount: String(receiveCount), SentTimestamp: '1795000000000' },
  eventSource: 'aws:sqs',
})

const created = (key: string) => ({
  Records: [
    {
      eventVersion: '2.1',
      eventSource: 'aws:s3',
      awsRegion: 'eu-north-1',
      eventName: 'ObjectCreated:Post',
      s3: { bucket: { name: 'documents-test' }, object: { key, size: 1024 } },
    },
  ],
})

// A draft waiting for its file, and the keys of the file and its processed copy.
async function upload() {
  const sub = randomUUID()
  const { id } = await createDraft(sub)
  return { sub, id, key: `raw/${sub}/${id}`, processed: `processed/${sub}/${id}` }
}

test('checks a PDF and counts its pages', async (t) => {
  const { sub, id, key, processed } = await upload()
  const bytes = pdf(3)
  fakeS3(t, { [key]: { type: 'application/pdf', bytes } })

  assert.deepEqual(await handler({ Records: [message(created(processed))] }), { batchItemFailures: [] })
  const doc = await getDocument(sub, id)
  assert.equal(doc?.status, 'done')
  assert.deepEqual(doc?.file, { type: 'application/pdf', size: bytes.length, pages: 3 })
})

test('checks a photo and keeps what preprocessing changed', async (t) => {
  const { sub, id, key, processed } = await upload()
  const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
  const reads = fakeS3(t, {
    [key]: { type: 'image/jpeg', bytes: photo },
    [processed]: { type: 'image/jpeg', bytes: photo, metadata: { change: 'levelled' } },
  })

  await handler({ Records: [message(created(processed))] })
  assert.deepEqual((await getDocument(sub, id))?.file, { type: 'image/jpeg', size: photo.length, pages: 1, change: 'levelled' })
  assert.deepEqual(reads, [key, processed])
})

test('checks a file once when S3 sends its event twice', async (t) => {
  const { key, processed } = await upload()
  const reads = fakeS3(t, { [key]: { type: 'application/pdf', bytes: pdf(1) } })

  await handler({ Records: [message(created(processed))] })
  await handler({ Records: [message(created(processed))] })
  assert.deepEqual(reads, [key])
})

test('fails a file whose content is not of its type, without retrying', async (t) => {
  const { sub, id, key, processed } = await upload()
  fakeS3(t, { [key]: { type: 'image/png', bytes: pdf(1) } })

  assert.deepEqual(await handler({ Records: [message(created(processed))] }), { batchItemFailures: [] })
  assert.equal((await getDocument(sub, id))?.status, 'failed')
})

test('fails a broken PDF without retrying', async (t) => {
  const { sub, id, key, processed } = await upload()
  fakeS3(t, { [key]: { type: 'application/pdf', bytes: new TextEncoder().encode('%PDF-1.4 broken') } })

  assert.deepEqual(await handler({ Records: [message(created(processed))] }), { batchItemFailures: [] })
  assert.equal((await getDocument(sub, id))?.status, 'failed')
})

test('retries when S3 fails and fails the file on the last try', async (t) => {
  const { sub, id, key, processed } = await upload()
  fakeS3(t, { [key]: Object.assign(new Error('Please reduce your request rate'), { name: 'SlowDown' }) })
  const messageId = randomUUID()

  for (const receiveCount of [1, 2]) {
    const result = await handler({ Records: [message(created(processed), messageId, receiveCount)] })
    assert.deepEqual(result, { batchItemFailures: [{ itemIdentifier: messageId }] })
    assert.equal((await getDocument(sub, id))?.status, 'processing')
  }
  await handler({ Records: [message(created(processed), messageId, 3)] })
  assert.equal((await getDocument(sub, id))?.status, 'failed')
})

test("skips S3's test event, originals and keys of no document", async (t) => {
  const reads = fakeS3(t, {})
  const result = await handler({
    Records: [
      message({ Service: 'Amazon S3', Event: 's3:TestEvent' }),
      message(created('processed/file.jpg')),
      message(created(`raw/${randomUUID()}/01KTEST0000000000000000002`)),
    ],
  })
  assert.deepEqual(result, { batchItemFailures: [] })
  assert.deepEqual(reads, [])
})
