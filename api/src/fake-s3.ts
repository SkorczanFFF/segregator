import type { TestContext } from 'node:test'
import { DeleteObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3'

// Read by the modules under test when they load, which happens after this module's imports.
process.env.DOCUMENTS_BUCKET = 'documents-test'

export type FakeFile = { type: string; bytes: Uint8Array; metadata?: Record<string, string> }

// Stands in for S3 with these files, and returns each command sent, as its name and key. Deletes always
// succeed. Each read gets its own copy, as from S3, because pdf.js takes over the buffer it reads.
export function fakeS3(t: TestContext, files: Record<string, FakeFile | Error> = {}) {
  const sent: string[] = []
  t.mock.method(S3Client.prototype, 'send', async (command: { input: { Key: string } }) => {
    sent.push(`${command.constructor.name} ${command.input.Key}`)
    if (command instanceof DeleteObjectCommand) return {}
    const file = files[command.input.Key]
    if (!file) throw new NoSuchKey({ message: 'No such key', $metadata: {} })
    if (file instanceof Error) throw file
    return {
      ContentType: file.type,
      Metadata: file.metadata ?? {},
      Body: { transformToByteArray: async () => file.bytes.slice() },
    }
  })
  return sent
}
