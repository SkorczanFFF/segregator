import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fakeS3 } from './fake-s3.ts'

const { handler } = await import('./draft-cleanup.ts')

const ID = '01KTEST0000000000000000002'

test('deletes both files of an expired draft and nothing for other items', async (t) => {
  const sent = fakeS3(t)

  await handler({
    Records: [
      { dynamodb: { Keys: { PK: { S: 'USER#0f1e2d3c-test' }, SK: { S: `DOC#${ID}` } } } },
      { dynamodb: { Keys: { PK: { S: 'SESSION#made-up' }, SK: { S: 'SESSION#made-up' } } } },
    ],
  })
  assert.deepEqual(sent.toSorted(), [
    `DeleteObjectCommand processed/0f1e2d3c-test/${ID}`,
    `DeleteObjectCommand raw/0f1e2d3c-test/${ID}`,
  ])
})
