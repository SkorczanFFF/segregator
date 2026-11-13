// Stable keys stored in the database; the web app translates them.
export const CATEGORIES = {
  receipt: ['fuel', 'groceries', 'pharmacy', 'electronics', 'other'],
  warranty: ['electronics', 'appliances', 'other'],
  policy: ['car', 'home', 'travel', 'other'],
  contract: ['rental', 'phone_internet', 'other'],
  bill: ['electricity', 'gas', 'water', 'phone_internet', 'other'],
  other: [],
} as const satisfies Record<string, readonly string[]>

export type DocumentType = keyof typeof CATEGORIES

export type Subtype = (typeof CATEGORIES)[DocumentType][number]

export const DOCUMENT_TYPES = Object.keys(CATEGORIES) as [DocumentType, ...DocumentType[]]
