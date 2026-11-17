import assert from 'node:assert/strict'
import { test } from 'node:test'
import { S3Client } from '@aws-sdk/client-s3'

process.env.DOCUMENTS_BUCKET = 'documents-test'

const { handler } = await import('./draft-cleanup.ts')

const ID = '01KTEST0000000000000000002'

test('deletes both files of an expired draft and nothing for other items', async (t) => {
  const sent: string[] = []
  t.mock.method(S3Client.prototype, 'send', async (command: { input: { Key: string } }) => {
    sent.push(`${command.constructor.name} ${command.input.Key}`)
    return {}
  })

  await handler({
    Records: [
      { dynamodb: { Keys: { PK: { S: 'USER#0f1e2d3c-test' }, SK: { S: `DOC#${ID}` } } } },
      { dynamodb: { Keys: { PK: { S: 'SESSION#made-up' }, SK: { S: 'SESSION#made-up' } } } },
    ],
  })
  assert.deepEqual(sent.sort(), [
    `DeleteObjectCommand processed/0f1e2d3c-test/${ID}`,
    `DeleteObjectCommand raw/0f1e2d3c-test/${ID}`,
  ])
})
