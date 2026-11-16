import * as z from 'zod'

// SVG and HTML stay out, because they can carry scripts.
export const FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const

export type FileType = (typeof FILE_TYPES)[number]

export const FILE_MAX_SIZE = 10 * 1024 * 1024

// Asks the API for a signed form that sends one file straight to S3.
export const UploadInput = z.object({ type: z.enum(FILE_TYPES) })

// The form to post with the file. S3 accepts only this key, type and size.
export type Upload = { id: string; url: string; fields: Record<string, string> }

export type DocumentFile = { type: FileType; size: number }
