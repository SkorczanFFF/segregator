import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DocumentInput, type Document, type Draft } from 'shared'
import { DEMO_OUT, PHOTO_TYPE, readManifest } from './demo-manifest.ts'
import { deleteAccountFiles, signUpload } from './document-files.ts'
import { chooseVersion, createDraft, deleteAccountItems, getDocument, updateDocument } from './document-table.ts'
import { queueRead } from './read-jobs.ts'
import { readLimits } from './read-limits.ts'
import { startRead } from './read-table.ts'
import { DEMO } from './session.ts'

// Replaces the demo account's documents with the ones demo/generate.py drew. Each photo goes through the stage's
// own pipeline, as an upload does, and about two thirds of them are read by the model before their true fields
// are saved, so the fields it got right keep its mark. For another stage: node --env-file=<its env file> src/seed-demo.ts

type State = 'waiting' | 'done' | 'failed'

const CHECK_TRIES = 60
const CHECK_PAUSE = 2000
// The same documents on every stage and every run.
const READ_SHARE = 2 / 3
const readByModel = (slug: string) => createHash('sha256').update(slug).digest()[0] < 256 * READ_SHARE

// Asks for the document until it is done, or throws when it failed or never got there.
async function until(id: string, what: string, state: (doc?: Document | Draft) => State) {
  for (let attempt = 0; attempt < CHECK_TRIES; attempt++) {
    const doc = await getDocument(DEMO.sub, id)
    const now = state(doc)
    if (doc && now === 'done') return doc
    if (now === 'failed') throw new Error(`${id}: the ${what} failed`)
    await new Promise((resolve) => setTimeout(resolve, CHECK_PAUSE))
  }
  throw new Error(`${id}: no ${what} after ${CHECK_TRIES} tries`)
}

const stateOf = (status?: string): State => (status === 'done' || status === 'failed' ? status : 'waiting')

// Reads the draft's file with the model, as the button does, and answers how many fields it got right.
async function read(id: string, fields: DocumentInput) {
  const started = await startRead(DEMO.sub, id, await readLimits())
  if (typeof started === 'string') throw new Error(`${id}: ${started}`)
  await queueRead({ sub: DEMO.sub, id, readId: started.readId })
  const result = (await until(id, 'reading', (doc) => stateOf(doc?.read?.status))).read?.result ?? {}
  const found = Object.entries(result)
  const right = found.filter(([field, value]) => fields[field as keyof DocumentInput] === value)
  return `read ${right.length} of ${found.length} right`
}

const manifest = await readManifest(DEMO_OUT)
await deleteAccountItems(DEMO.sub)
await deleteAccountFiles(DEMO.sub)

for (const entry of manifest) {
  const fields = DocumentInput.parse(entry.fields)
  const bytes = await readFile(join(DEMO_OUT, entry.raw.file))
  const draft = await createDraft(DEMO.sub, createHash('sha256').update(bytes).digest('hex'), bytes.length)
  const { url, fields: post } = await signUpload(DEMO.sub, draft.id, PHOTO_TYPE, bytes.length)
  const form = new FormData()
  for (const [name, value] of Object.entries(post)) form.append(name, value)
  form.append('file', new Blob([bytes], { type: PHOTO_TYPE }))
  const sent = await fetch(url, { method: 'POST', body: form })
  if (!sent.ok) throw new Error(`${entry.slug}: S3 answered ${sent.status}`)

  const { file } = await until(draft.id, 'check', (doc) => stateOf(doc?.status))
  if (file?.change) await chooseVersion(DEMO.sub, draft.id, 'processed')
  const reading = readByModel(entry.slug) ? await read(draft.id, fields) : 'typed in'
  if (!(await updateDocument(DEMO.sub, draft.id, fields))) throw new Error(`${entry.slug}: not saved`)
  const expected = entry.processed?.change ?? 'unchanged'
  const got = file?.change ?? 'unchanged'
  console.log(`${entry.slug}: ${got}${got === expected ? '' : `, the generator got ${expected}`}, ${reading}`)
}
