import * as z from 'zod'
import { CATEGORIES, DOCUMENT_TYPES } from './categories.ts'
import type { DocumentFile } from './file.ts'

export const TEXT_MAX_LENGTH = 120

const text = z.string().trim().min(1).max(TEXT_MAX_LENGTH)

// What a person enters for a document. Amounts are whole grosze, so sums never round.
const DocumentFields = z.object({
  type: z.enum(DOCUMENT_TYPES),
  subtype: z.string().optional(),
  title: text.optional(),
  issuer: text,
  amount: z.number().int().min(0).max(1_000_000_000).optional(),
  docDate: z.iso.date(),
})

const subtypeFits = (doc: z.infer<typeof DocumentFields>) =>
  doc.subtype === undefined || (CATEGORIES[doc.type] as readonly string[]).includes(doc.subtype)

export const DocumentInput = DocumentFields.refine(subtypeFits, { path: ['subtype'] })

export type DocumentInput = z.infer<typeof DocumentInput>

// A new document may come with a file that is already in S3.
export const NewDocumentInput = DocumentFields.extend({ fileId: z.ulid().optional() }).refine(subtypeFits, {
  path: ['subtype'],
})

export type NewDocumentInput = z.infer<typeof NewDocumentInput>

export type Document = DocumentInput & { id: string; createdAt: string; file?: DocumentFile }
