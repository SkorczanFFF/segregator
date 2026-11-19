import { usedVersion, type DocumentFile } from 'shared'
import { readFile } from './document-files.ts'
import { getDocument } from './document-table.ts'
import { readWithModel } from './read-model.ts'
import { finishRead } from './read-table.ts'
import { ReadJob } from './read-jobs.ts'

type SqsMessage = { messageId: string; body: string; attributes: { ApproximateReceiveCount: string } }

const MAX_RECEIVES = Number(process.env.MAX_RECEIVES)

async function ask(sub: string, id: string, file: DocumentFile) {
  const { type, bytes } = await readFile(sub, id, usedVersion(file))
  const { result, ...counts } = await readWithModel(type, bytes)
  // Counts only, for the cost of a reading. Neither the document nor the answer goes to the logs.
  console.info('Read', counts)
  return result
}

async function processMessage(message: SqsMessage) {
  const job = ReadJob.parse(JSON.parse(message.body))
  const doc = await getDocument(job.sub, job.id)
  // Deleted, read again since, or finished on an earlier try: nothing is left to do.
  if (doc?.read?.id !== job.readId || doc.read.status !== 'reading' || !doc.file) return
  try {
    await finishRead(job.sub, job.id, job.readId, await ask(job.sub, job.id, doc.file))
  } catch (err) {
    // On the last try the reading fails, so the page stops waiting for it.
    if (Number(message.attributes.ApproximateReceiveCount) >= MAX_RECEIVES) await finishRead(job.sub, job.id, job.readId)
    throw err
  }
}

// A failed message goes back to the queue alone, so the rest of its batch never runs again.
export async function handler(event: { Records: SqsMessage[] }) {
  const batchItemFailures: { itemIdentifier: string }[] = []
  for (const message of event.Records) {
    try {
      await processMessage(message)
    } catch (err) {
      console.error('Reading failed', message.messageId, err)
      batchItemFailures.push({ itemIdentifier: message.messageId })
    }
  }
  return { batchItemFailures }
}
