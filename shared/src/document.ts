import * as z from 'zod'
import { CATEGORIES, DOCUMENT_TYPES } from './categories.ts'

const text = (max: number) => z.string().trim().min(1).max(max)

// What a person enters for a document. Amounts are whole grosze, so sums never round.
export const DocumentInput = z
  .object({
    type: z.enum(DOCUMENT_TYPES),
    subtype: z.string().optional(),
    title: text(120).optional(),
    issuer: text(120),
    amount: z.number().int().min(0).max(1_000_000_000).optional(),
    docDate: z.iso.date(),
  })
  .refine(
    (doc) => doc.subtype === undefined || (CATEGORIES[doc.type] as readonly string[]).includes(doc.subtype),
    { path: ['subtype'] },
  )

export type DocumentInput = z.infer<typeof DocumentInput>

export type Document = DocumentInput & { id: string; createdAt: string }
