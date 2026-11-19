import type { TFunction } from 'i18next'
import type { Document, Subtype } from 'shared'
import { decimalSeparator } from '~/shared/lib/format.ts'

// Semicolons, as a Polish Excel expects, and a byte order mark, so it reads the text as UTF-8.
const SEPARATOR = ';'
const BOM = '\uFEFF'

// A spreadsheet runs a cell that starts with one of these as a formula, so such text gets a quote in front.
const FORMULA_START = /^[=+\-@\t\r]/

function cell(value: string) {
  const text = FORMULA_START.test(value) ? `'${value}` : value
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// The documents as a CSV file. Dates are ISO days, which spreadsheets read in any language, and amounts have
// the language's decimal separator and no currency.
export function documentsCsv(t: TFunction, docs: Document[]) {
  const separator = decimalSeparator() ?? '.'
  const amount = (grosze?: number) => (grosze === undefined ? '' : (grosze / 100).toFixed(2).replace('.', separator))
  const rows = [
    [
      t('documents.fields.docDate'),
      t('documents.fields.type'),
      t('documents.fields.subtype'),
      t('documents.fields.title'),
      t('documents.fields.issuer'),
      t('documents.fields.amount'),
      t('documents.fields.dueDate'),
    ],
    ...docs.map((doc) => [
      doc.docDate,
      t(`categories.types.${doc.type}`),
      doc.subtype ? t(`categories.subtypes.${doc.subtype as Subtype}`) : '',
      doc.title ?? '',
      doc.issuer,
      amount(doc.amount),
      doc.dueDate ?? '',
    ]),
  ]
  return BOM + rows.map((row) => row.map(cell).join(SEPARATOR)).join('\r\n')
}

// Hands the browser a file to save.
export function saveFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Some browsers start the download only after the click returns.
  setTimeout(() => URL.revokeObjectURL(url))
}
