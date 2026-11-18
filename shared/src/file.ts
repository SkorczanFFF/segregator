// SVG and HTML stay out, because they can carry scripts.
export const FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const

export type FileType = (typeof FILE_TYPES)[number]

// A PDF goes to S3 as it is; any other type is a photo.
export const isPdf = (type: string) => type === 'application/pdf'

export const FILE_MAX_SIZE = 10 * 1024 * 1024

// How far back the table can be restored, its longest. A deleted or replaced file stays as an older version as
// long, so a restored document still has its file, and deleted data is gone for good after it.
export const RESTORE_DAYS = 35

// What one account may keep, counted in files as sent, drafts included. A processed copy doesn't count.
export const STORAGE_LIMIT = 500 * 1024 * 1024

// The bytes an account's files take now.
export type StorageUse = { used: number }

// The form to post with the file. S3 accepts only this key, type and size.
export type Upload = { id: string; url: string; fields: Record<string, string> }

// A document keeps its file as sent under raw/ and the copy preprocess/ makes for reading under processed/.
export const FILE_VERSIONS = ['raw', 'processed'] as const

export type FileVersion = (typeof FILE_VERSIONS)[number]

// What preprocess/handler.py did to a photo: cut the sheet out of it, or level its lines of text.
export const FILE_CHANGES = ['cut', 'levelled'] as const

export type FileChange = (typeof FILE_CHANGES)[number]

// Checked by the worker. Files saved before it counted pages have no count. A photo preprocessing changed
// has both versions, and use is the one the person chose.
export type DocumentFile = { type: FileType; size: number; pages?: number; change?: FileChange; use?: FileVersion }

// A photo preprocessing changed waits for a version to be chosen before its fields can be saved. The API's
// updateDocument checks the same in its condition.
export const needsChoice = (file?: DocumentFile) => Boolean(file?.change && !file.use)

// The version a document goes with: the one chosen, or the file as sent when nothing changed.
export const usedVersion = (file: DocumentFile): FileVersion => file.use ?? 'raw'
