import i18n from 'i18next'

const money = (notation: Intl.NumberFormatOptions['notation'] = 'standard') =>
  new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'PLN', notation })

// Amounts are stored in grosze. Compact notation shortens large ones, e.g. 10 mln zł.
export const formatMoney = (grosze: number, notation?: Intl.NumberFormatOptions['notation']) =>
  money(notation).format(grosze / 100)

// The currency as formatMoney writes it, e.g. zł.
export const currencySymbol = () =>
  money()
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value

// The decimal separator of the language, e.g. a comma in Polish.
export const decimalSeparator = () =>
  new Intl.NumberFormat(i18n.language).formatToParts(0.5).find((part) => part.type === 'decimal')?.value

// A date from a document has no time zone, so it is formatted in UTC to keep the same day everywhere.
const documentFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(i18n.language, { ...options, timeZone: 'UTC' })

const documentDate = (options: Intl.DateTimeFormatOptions) => (isoDate: string) =>
  documentFormat(options).format(new Date(isoDate))

// Whole months such as 2026-09 to 2026-11: one month by its name, e.g. listopad 2026, a whole year by its
// number, the months of one year with the year once, e.g. wrz–lis 2026, and others in full, e.g.
// lis 2025 – lut 2026.
export function formatMonths(from: string, to: string) {
  const [first, last] = [new Date(`${from}-01`), new Date(`${to}-01`)]
  const year = from.slice(0, 4)
  if (from === to) return documentFormat({ month: 'long', year: 'numeric' }).format(first)
  if (year !== to.slice(0, 4)) return documentFormat({ month: 'short', year: 'numeric' }).formatRange(first, last)
  if (from.endsWith('-01') && to.endsWith('-12')) return year
  return `${documentFormat({ month: 'short' }).formatRange(first, last)} ${year}`
}

// Days such as 2026-11-03 to 2026-11-16, e.g. 3–16 lis 2026.
export const formatDays = (from: string, to: string) =>
  documentFormat({ day: 'numeric', month: 'short', year: 'numeric' }).formatRange(new Date(from), new Date(to))

export const formatDate = documentDate({ dateStyle: 'medium' })

// A moment, such as when a document was added, on the day it was where the person is.
export const formatDay = (isoTime: string) =>
  new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(isoTime))

// The day and month, e.g. 15.11.
export const formatDayMonth = documentDate({ day: '2-digit', month: '2-digit' })

// The name of a month such as 2026-11, e.g. listopad.
export const formatMonthName = (isoMonth: string) => documentDate({ month: 'long' })(`${isoMonth}-01`)

const MEGABYTE = 1024 * 1024

export const formatFileSize = (bytes: number) =>
  new Intl.NumberFormat(i18n.language, {
    style: 'unit',
    unit: bytes < MEGABYTE ? 'kilobyte' : 'megabyte',
    maximumFractionDigits: 1,
  }).format(bytes < MEGABYTE ? bytes / 1024 : bytes / MEGABYTE)

// The short name of a file type, e.g. JPEG for image/jpeg.
export const fileFormat = (type: string) => type.slice(type.indexOf('/') + 1).toUpperCase()
