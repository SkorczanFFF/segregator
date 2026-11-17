import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { deleteFiles } from './document-files.ts'
import { parseDocKey } from './document-table.ts'

// The part of a table stream record the cleanup reads. The event source passes only documents TTL removed.
type StreamRecord = { dynamodb: { Keys: Record<string, AttributeValue> } }

// Deletes the files of drafts nobody saved, once TTL removes them from the table. Only drafts expire, since
// saving the fields ends the expiry. A failure fails the batch, and deleting again is harmless.
export async function handler(event: { Records: StreamRecord[] }) {
  for (const record of event.Records) {
    const doc = parseDocKey(record.dynamodb.Keys)
    if (doc) await deleteFiles(doc.sub, doc.id)
  }
}
