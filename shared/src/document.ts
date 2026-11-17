import * as z from 'zod'
import { CATEGORIES, DOCUMENT_TYPES } from './categories.ts'
import { FILE_TYPES, type DocumentFile } from './file.ts'

export const TEXT_MAX_LENGTH = 120

// In grosze, so 10 million zloty.
export const AMOUNT_MAX = 1_000_000_000

const text = z.string().trim().min(1).max(TEXT_MAX_LENGTH)

// What a person enters for a document. Amounts are whole grosze, so sums never round.
const DocumentFields = z.object({
  type: z.enum(DOCUMENT_TYPES),
  subtype: z.string().optional(),
  title: text.optional(),
  issuer: text,
  amount: z.number().int().min(0).max(AMOUNT_MAX).optional(),
  docDate: z.iso.date(),
})

const subtypeFits = (doc: z.infer<typeof DocumentFields>) =>
  doc.subtype === undefined || (CATEGORIES[doc.type] as readonly string[]).includes(doc.subtype)

export const DocumentInput = DocumentFields.refine(subtypeFits, { path: ['subtype'] })

export type DocumentInput = z.infer<typeof DocumentInput>

// A new document with a file: its fields and the type of the file the browser sends next.
export const UploadInput = DocumentFields.extend({ fileType: z.enum(FILE_TYPES) }).refine(subtypeFits, {
  path: ['subtype'],
})

// A document without a file is done at once. One with a file waits for it, then the worker checks it.
export type DocumentStatus = 'uploading' | 'processing' | 'done' | 'failed'

export type Document = DocumentInput & { id: string; createdAt: string; status: DocumentStatus; file?: DocumentFile }

// One page of the list, newest first. The cursor fetches the next one.
export type DocumentList = { items: Document[]; cursor?: string }
