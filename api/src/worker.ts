import { FILE_TYPES, isPdf, type FileType } from 'shared'
import { parseFileKey, readFile } from './document-files.ts'
import { claimDocument, settleDocument, type CheckResult } from './document-table.ts'

// The parts of the SQS and S3 events the worker reads.
type SqsMessage = { messageId: string; body: string; attributes: { ApproximateReceiveCount: string } }
type S3Notification = { Records?: { s3: { object: { key: string } } }[] }

// Set by the stack to the queue's limit, after which a message moves to the dead-letter queue.
const MAX_RECEIVES = Number(process.env.MAX_RECEIVES)

// The first bytes of each file type.
const SIGNATURES: Record<FileType, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'application/pdf': [0x25, 0x50, 0x44, 0x46, 0x2d],
}

// pdf.js throws these for a file that will never open, so another try can't help.
const BROKEN_PDF = new Set(['InvalidPDFException', 'PasswordException', 'FormatError'])

const typeOf = (bytes: Uint8Array) =>
  FILE_TYPES.find((type) => SIGNATURES[type].every((byte, i) => bytes[i] === byte))

async function countPages(bytes: Uint8Array) {
  // pdf.js is large, so it loads only for a PDF. It runs its worker in this thread when it finds it
  // on globalThis, so the bundle needs no separate worker file.
  const [pdfjs, pdfWorker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ])
  Object.assign(globalThis, { pdfjsWorker: pdfWorker })
  const task = pdfjs.getDocument({ data: bytes, verbosity: pdfjs.VerbosityLevel.ERRORS })
  try {
    return (await task.promise).numPages
  } finally {
    await task.destroy()
  }
}

async function checkFile(sub: string, id: string): Promise<CheckResult> {
  const { type: declared, bytes } = await readFile(sub, id)
  // The browser declared the type, so the content has to match it.
  const type = typeOf(bytes)
  if (!type || type !== declared) return { status: 'failed' }
  // Taken before pdf.js, which empties the buffer it reads.
  const size = bytes.length
  try {
    return { status: 'done', file: { type, size, pages: isPdf(type) ? await countPages(bytes) : 1 } }
  } catch (err) {
    if (err instanceof Error && BROKEN_PDF.has(err.name)) return { status: 'failed' }
    throw err
  }
}

// S3 may send the same event twice and SQS may deliver a message twice, so the claim lets one message
// work on a document. A retry of that same message gets it back.
async function processFile(sub: string, id: string, message: SqsMessage) {
  if (!(await claimDocument(sub, id, message.messageId))) return
  try {
    await settleDocument(sub, id, message.messageId, await checkFile(sub, id))
  } catch (err) {
    // On the last try the document fails before the message moves to the dead-letter queue.
    if (Number(message.attributes.ApproximateReceiveCount) >= MAX_RECEIVES) {
      await settleDocument(sub, id, message.messageId, { status: 'failed' })
    }
    throw err
  }
}

async function processMessage(message: SqsMessage) {
  // S3's test event, sent when the notification is set up, has no records.
  const notification = JSON.parse(message.body) as S3Notification
  for (const record of notification.Records ?? []) {
    // S3 encodes the key as in a URL, with spaces as plus signs.
    // The straightened copy under processed/ means preprocessing is done. The check reads the original.
    const file = parseFileKey(decodeURIComponent(record.s3.object.key.replaceAll('+', ' ')))
    if (file?.stage === 'processed') await processFile(file.sub, file.id, message)
    else console.warn('Skipped a key that is not a processed document file')
  }
}

// A failed message goes back to the queue alone, so the rest of its batch never runs again.
export async function handler(event: { Records: SqsMessage[] }) {
  const batchItemFailures: { itemIdentifier: string }[] = []
  for (const message of event.Records) {
    try {
      await processMessage(message)
    } catch (err) {
      console.error('File check failed', message.messageId, err)
      batchItemFailures.push({ itemIdentifier: message.messageId })
    }
  }
  return { batchItemFailures }
}
