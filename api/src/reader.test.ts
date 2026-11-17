import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test, type TestContext } from 'node:test'
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { fakeS3 } from './fake-s3.ts'
import { randomHash, setUpLocalTable } from './local-table.ts'

setUpLocalTable('reader-test')
process.env.MAX_RECEIVES = '3'
process.env.READ_MODEL = 'model-under-test'

const { handler } = await import('./reader.ts')
const { chooseVersion, claimDocument, createDraft, getDocument, settleDocument, startRead } = await import(
  './document-table.ts'
)

const LIMITS = { account: 100, app: 1_000_000 }
const photo = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])

// Stands in for the model: answers with this tool input, or throws it. Returns the requests it got.
function fakeModel(t: TestContext, answer: unknown) {
  const requests: { modelId: string; messages: { content: Record<string, unknown>[] }[] }[] = []
  t.mock.method(BedrockRuntimeClient.prototype, 'send', async (command: { input: (typeof requests)[number] }) => {
    requests.push(command.input)
    if (answer instanceof Error) throw answer
    return {
      output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: 't', name: 'record_document', input: answer } }] } },
      usage: { inputTokens: 1200, outputTokens: 40 },
    }
  })
  return requests
}

// A photo whose reading has started, as the API leaves it, and the reader's message for it.
async function reading(change?: 'cut') {
  const sub = randomUUID()
  const { id } = await createDraft(sub, randomHash(), photo.length)
  await claimDocument(sub, id, 'check')
  await settleDocument(sub, id, 'check', { status: 'done', file: { type: 'image/jpeg', size: photo.length, pages: 1, change } })
  if (change) await chooseVersion(sub, id, 'processed')
  const started = await startRead(sub, id, LIMITS)
  assert.ok(typeof started === 'object')
  const message = (receiveCount = 1) => ({
    messageId: randomUUID(),
    body: JSON.stringify({ sub, id, readId: started.readId }),
    attributes: { ApproximateReceiveCount: String(receiveCount) },
  })
  return { sub, id, message, files: { [`raw/${sub}/${id}`]: { type: 'image/jpeg', bytes: photo }, [`processed/${sub}/${id}`]: { type: 'image/jpeg', bytes: photo } } }
}

test('keeps the fields of an answer that hold up, in grosze', async (t) => {
  const { sub, id, message, files } = await reading('cut')
  const sent = fakeS3(t, files)
  const requests = fakeModel(t, {
    type: 'invoice',
    subtype: 'electronics',
    issuer: 'Hurtownia Elektro-Mont',
    amount: 1249,
    docDate: '2026-11-12',
    dueDate: '2026-11-26',
  })

  assert.deepEqual(await handler({ Records: [message()] }), { batchItemFailures: [] })
  const read = (await getDocument(sub, id))?.read
  assert.equal(read?.status, 'done')
  assert.deepEqual(read?.result, {
    type: 'invoice',
    subtype: 'electronics',
    issuer: 'Hurtownia Elektro-Mont',
    amount: 124900,
    docDate: '2026-11-12',
    dueDate: '2026-11-26',
  })
  assert.deepEqual(sent, [`GetObjectCommand processed/${sub}/${id}`], 'the version chosen')
  assert.equal(requests[0]?.modelId, 'model-under-test')
})

test("leaves out what doesn't fit the document's rules", async (t) => {
  const { sub, id, message, files } = await reading()
  fakeS3(t, files)
  fakeModel(t, { type: 'receipt', subtype: 'car', issuer: 'x'.repeat(500), amount: 47.85, docDate: '17.11.2026', dueDate: '2026-12-01' })

  await handler({ Records: [message()] })
  assert.deepEqual((await getDocument(sub, id))?.read?.result, { type: 'receipt', amount: 4785 })
})

test('fails a reading that found only the type, or answered out of shape', async (t) => {
  for (const answer of [{ type: 'receipt' }, { type: 'letter', issuer: 'Sklep' }, 'not an object']) {
    const { sub, id, message, files } = await reading()
    fakeS3(t, files)
    fakeModel(t, answer)
    await handler({ Records: [message()] })
    assert.deepEqual((await getDocument(sub, id))?.read?.status, 'failed', JSON.stringify(answer))
    t.mock.restoreAll()
  }
})

test('retries when the model fails and fails the reading on the last try', async (t) => {
  const { sub, id, message, files } = await reading()
  fakeS3(t, files)
  fakeModel(t, Object.assign(new Error('Rate exceeded'), { name: 'ThrottlingException' }))

  const first = message(1)
  assert.deepEqual(await handler({ Records: [first] }), { batchItemFailures: [{ itemIdentifier: first.messageId }] })
  assert.equal((await getDocument(sub, id))?.read?.status, 'reading')
  await handler({ Records: [message(3)] })
  assert.equal((await getDocument(sub, id))?.read?.status, 'failed')
})

test('skips a message of any other reading of the document', async (t) => {
  const { sub, id, message, files } = await reading()
  const current = message()
  const sent = fakeS3(t, files)
  const requests = fakeModel(t, { type: 'receipt', issuer: 'Sklep' })
  await handler({ Records: [{ ...current, body: JSON.stringify({ sub, id, readId: 'an older reading' }) }, current] })
  assert.equal(requests.length, 1, 'only the current reading asks the model')
  assert.equal(sent.length, 1)
})
