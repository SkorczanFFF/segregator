import * as z from 'zod'
import { DOCUMENT_TYPES, hasDueDate, isSubtypeOf } from './categories.ts'
import { FILE_MAX_SIZE, FILE_TYPES, FILE_VERSIONS, type DocumentFile } from './file.ts'

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
    dueDate: z.iso.date().optional(),
  })
  .refine((doc) => doc.subtype === undefined || isSubtypeOf(doc.type, doc.subtype), { path: ['subtype'] })
  .refine((doc) => doc.dueDate === undefined || hasDueDate(doc.type), { path: ['dueDate'] })

export type DocumentInput = z.infer<typeof DocumentInput>

// A document from a file starts with the file alone; its fields come once its photo is approved. The hash is
// the SHA-256 of the file as picked, in hex, so the same file is found again however the browser prepared it.
// The size is that of the file to send, which the signed upload then holds S3 to.
export const UploadInput = z.object({
  fileType: z.enum(FILE_TYPES),
  fileHash: z.string().regex(/^[0-9a-f]{64}$/),
  fileSize: z.number().int().min(1).max(FILE_MAX_SIZE),
})

export type UploadInput = z.infer<typeof UploadInput>

// The version of a changed photo the person keeps.
export const FileChoice = z.object({ use: z.enum(FILE_VERSIONS) })

export type FileChoice = z.infer<typeof FileChoice>

// A document with a file waits for it, then the worker checks it. One without a file is done at once.
export type DocumentStatus = 'uploading' | 'processing' | 'done' | 'failed'

// The model that reads documents, through its EU inference profile. The reader may call this one and no other.
export const READ_MODEL = 'eu.amazon.nova-2-lite-v1:0'

// The fields a reading of the file by the model can fill. The person checks them before saving.
export type ReadResult = Partial<Pick<DocumentInput, 'type' | 'subtype' | 'issuer' | 'amount' | 'docDate' | 'dueDate'>>

// The latest reading of a document's file: under way, done with its result, or failed when the model's answer
// didn't hold up.
export type DocumentRead = { id: string; status: 'reading' | 'done' | 'failed'; result?: ReadResult }

// The account's readings this month against its limit. Closed once the whole app has used up its own.
export type ReadUse = { used: number; limit: number; open: boolean }

type Stored = { id: string; createdAt: string; status: DocumentStatus; file?: DocumentFile; read?: DocumentRead }

export type Document = DocumentInput & Stored & { draft?: never }

// A document whose file came first. It has no fields until they are saved, and the list doesn't show it.
export type Draft = Stored & { draft: true }

// What the list is narrowed to: documents dated from and to, both days included, of some types, and of one
// subcategory when one type is chosen. Nothing set lists every document.
export const DocumentFilter = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    types: z.array(z.enum(DOCUMENT_TYPES)).optional(),
    subtype: z.string().optional(),
  })
  .refine((filter) => !filter.from || !filter.to || filter.from <= filter.to, { path: ['to'] })
  .refine(({ types, subtype }) => subtype === undefined || (types?.length === 1 && isSubtypeOf(types[0]!, subtype)), {
    path: ['subtype'],
  })

export type DocumentFilter = z.infer<typeof DocumentFilter>

// How many documents the whole filtered list has and their amounts added up, in grosze.
export type ListSummary = { count: number; total: number }

// One page of the list, newest first. The cursor fetches the next one. The first page also sums up the
// whole list.
export type DocumentList = { items: Document[]; cursor?: string; summary?: ListSummary }
