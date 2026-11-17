// SVG and HTML stay out, because they can carry scripts.
export const FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const

export type FileType = (typeof FILE_TYPES)[number]

// A PDF goes to S3 as it is; any other type is a photo.
export const isPdf = (type: string) => type === 'application/pdf'

export const FILE_MAX_SIZE = 10 * 1024 * 1024

// The form to post with the file. S3 accepts only this key, type and size.
export type Upload = { id: string; url: string; fields: Record<string, string> }

// Checked by the worker. Files saved before it counted pages have no count.
export type DocumentFile = { type: FileType; size: number; pages?: number }
