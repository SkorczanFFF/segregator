import * as z from 'zod'
import { CATEGORIES, DOCUMENT_TYPES } from './categories.ts'
import { FILE_TYPES, FILE_VERSIONS, type DocumentFile } from './file.ts'

export const TEXT_MAX_LENGTH = 120

// In grosze, so 10 million zloty.
export const AMOUNT_MAX = 1_000_000_000

const text = z.string().trim().min(1).max(TEXT_MAX_LENGTH)

// What a person enters for a document. Amounts are whole grosze, so sums never round.
export const DocumentInput = z
  .object({
    type: z.enum(DOCUMENT_TYPES),
    subtype: z.string().optional(),
    title: text.optional(),
    issuer: text,
    amount: z.number().int().min(0).max(AMOUNT_MAX).optional(),
    docDate: z.iso.date(),
  })
  .refine((doc) => doc.subtype === undefined || (CATEGORIES[doc.type] as readonly string[]).includes(doc.subtype), {
    path: ['subtype'],
  })

export type DocumentInput = z.infer<typeof DocumentInput>

// A document from a file starts with the file alone; its fields come once its photo is approved.
export const UploadInput = z.object({ fileType: z.enum(FILE_TYPES) })

// The version of a changed photo the person keeps.
export const FileChoice = z.object({ use: z.enum(FILE_VERSIONS) })

export type FileChoice = z.infer<typeof FileChoice>

// A document with a file waits for it, then the worker checks it. One without a file is done at once.
export type DocumentStatus = 'uploading' | 'processing' | 'done' | 'failed'

type Stored = { id: string; createdAt: string; status: DocumentStatus; file?: DocumentFile }

export type Document = DocumentInput & Stored & { draft?: never }

// A document whose file came first. It has no fields until they are saved, and the list doesn't show it.
export type Draft = Stored & { draft: true }

// One page of the list, newest first. The cursor fetches the next one.
export type DocumentList = { items: Document[]; cursor?: string }
