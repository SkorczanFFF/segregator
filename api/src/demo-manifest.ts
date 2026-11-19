import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileChange, FileType } from 'shared'

// A document demo/generate.py drew: the fields it prints, its photo, and the straightened photo when
// straightening changed it.
export type ManifestEntry = {
  slug: string
  fields: unknown
  raw: { file: string }
  processed?: { file: string; change?: FileChange }
}

// Where demo/generate.py writes the demo's documents; those of the reading check go to eval/ inside it.
export const DEMO_OUT = '../demo/out'
export const PHOTO_TYPE: FileType = 'image/jpeg'

export const readManifest = async (dir: string): Promise<ManifestEntry[]> =>
  JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'))
