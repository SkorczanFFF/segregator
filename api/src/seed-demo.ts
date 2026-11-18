import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DocumentInput, type FileChange } from 'shared'
import { deleteAccountFiles, signUpload } from './document-files.ts'
import { chooseVersion, createDraft, deleteAccountItems, getDocument, updateDocument } from './document-table.ts'
import { DEMO } from './session.ts'

// Replaces the demo account's documents with the ones demo/generate.py drew. Each photo goes through the stage's
// own pipeline, as an upload does. For another stage: node --env-file=<its env file> src/seed-demo.ts

type Entry = { slug: string; fields: unknown; raw: { file: string }; processed?: { change?: FileChange } }

const DIR = '../demo/out'
const TYPE = 'image/jpeg'
const CHECK_TRIES = 60
const CHECK_PAUSE = 2000

async function checked(id: string) {
  for (let attempt = 0; attempt < CHECK_TRIES; attempt++) {
    const doc = await getDocument(DEMO.sub, id)
    if (doc?.status === 'done') return doc
    if (doc?.status === 'failed') throw new Error(`${id}: the check failed`)
    await new Promise((resolve) => setTimeout(resolve, CHECK_PAUSE))
  }
  throw new Error(`${id}: not checked after ${CHECK_TRIES} tries`)
}

const manifest: Entry[] = JSON.parse(await readFile(join(DIR, 'manifest.json'), 'utf8'))
await deleteAccountItems(DEMO.sub)
await deleteAccountFiles(DEMO.sub)

for (const entry of manifest) {
  const bytes = await readFile(join(DIR, entry.raw.file))
  const draft = await createDraft(DEMO.sub, createHash('sha256').update(bytes).digest('hex'), bytes.length)
  const { url, fields } = await signUpload(DEMO.sub, draft.id, TYPE, bytes.length)
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) form.append(name, value)
  form.append('file', new Blob([bytes], { type: TYPE }))
  const sent = await fetch(url, { method: 'POST', body: form })
  if (!sent.ok) throw new Error(`${entry.slug}: S3 answered ${sent.status}`)

  const { file } = await checked(draft.id)
  if (file?.change) await chooseVersion(DEMO.sub, draft.id, 'processed')
  if (!(await updateDocument(DEMO.sub, draft.id, DocumentInput.parse(entry.fields)))) {
    throw new Error(`${entry.slug}: not saved`)
  }
  const expected = entry.processed?.change ?? 'unchanged'
  const got = file?.change ?? 'unchanged'
  console.log(`${entry.slug}: ${got}${got === expected ? '' : `, the generator got ${expected}`}`)
}
