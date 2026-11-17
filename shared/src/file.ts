// SVG and HTML stay out, because they can carry scripts.
export const FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const

export type FileType = (typeof FILE_TYPES)[number]

// A PDF goes to S3 as it is; any other type is a photo.
export const isPdf = (type: string) => type === 'application/pdf'

export const FILE_MAX_SIZE = 10 * 1024 * 1024

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
