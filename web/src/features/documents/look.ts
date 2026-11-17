import type { MantineColor } from '@mantine/core'
import {
  IconBolt,
  IconCertificate,
  IconFileInvoice,
  IconFileText,
  IconReceipt,
  IconShieldCheck,
  IconSignature,
  type Icon,
} from '@tabler/icons-react'
import type { TFunction } from 'i18next'
import { hasDueDate, type DocumentInput, type DocumentType, type Subtype } from 'shared'
import { formatDate } from '~/shared/lib/format.ts'

// Each type has its own icon and color, so documents read at a glance. strong is the shade
// of a filled button in that color, deep enough for white text at 4.5:1 or more.
export const TYPE_LOOKS = {
  receipt: { icon: IconReceipt, color: 'brand', strong: 'brand.7' },
  invoice: { icon: IconFileInvoice, color: 'saffron', strong: 'saffron.8' },
  // Mantine's darkest green leaves white text at 4.4:1, so a shade deeper.
  warranty: { icon: IconCertificate, color: 'green', strong: '#237032' },
  policy: { icon: IconShieldCheck, color: 'cyan', strong: 'cyan.9' },
  contract: { icon: IconSignature, color: 'pink', strong: 'pink.8' },
  bill: { icon: IconBolt, color: 'blue', strong: 'blue.8' },
  other: { icon: IconFileText, color: 'gray', strong: 'gray.7' },
} satisfies Record<DocumentType, { icon: Icon; color: MantineColor; strong: MantineColor }>

// How far a card's content sits from its edges, in the list and in the form: less on a phone.
export const CARD_INSET = { base: 'md', sm: 'xl' } as const

// A document's page: the fields alone, or wide enough for the file in a column beside them.
export const PAGE_WIDTH = { fields: 560, withFile: 1100 } as const

// A document's own name, or its issuer when it has none.
export const documentName = (doc: Pick<DocumentInput, 'title' | 'issuer'>) => doc.title ?? doc.issuer

// The label of a document's due date, which depends on its type, e.g. pay by for an invoice.
export const dueDateLabel = (t: TFunction, type: DocumentType) =>
  hasDueDate(type) ? t(`documents.due.${type as Exclude<DocumentType, 'receipt'>}`) : undefined

// What a document is: its type, subcategory, when its name is its own the issuer, and its due date.
export const describeDocument = (
  t: TFunction,
  doc: Pick<DocumentInput, 'type' | 'subtype' | 'title' | 'issuer' | 'dueDate'>,
) =>
  [
    t(`categories.types.${doc.type}`),
    doc.subtype && t(`categories.subtypes.${doc.subtype as Subtype}`),
    doc.title && doc.issuer,
    doc.dueDate && `${dueDateLabel(t, doc.type)?.toLocaleLowerCase()} ${formatDate(doc.dueDate)}`,
  ]
    .filter(Boolean)
    .join(' · ')
