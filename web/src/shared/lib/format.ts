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

// A date from a document has no time zone, so it is formatted in UTC to keep the same day everywhere.
const documentDate = (options: Intl.DateTimeFormatOptions) => (isoDate: string) =>
  new Intl.DateTimeFormat(i18n.language, { ...options, timeZone: 'UTC' }).format(new Date(isoDate))

export const formatDate = documentDate({ dateStyle: 'medium' })

// A moment, such as when a document was added, on the day it was where the person is.
export const formatDay = (isoTime: string) =>
  new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(isoTime))

// The day and month, e.g. 15.11.
export const formatDayMonth = documentDate({ day: '2-digit', month: '2-digit' })

// A month such as 2026-11, e.g. listopad 2026.
export const formatMonth = (isoMonth: string) => documentDate({ month: 'long', year: 'numeric' })(`${isoMonth}-01`)

const MEGABYTE = 1024 * 1024

// Below 1 MB in kB, so a small file doesn't show as 0 MB.
export const formatFileSize = (bytes: number) =>
  new Intl.NumberFormat(i18n.language, {
    style: 'unit',
    unit: bytes < MEGABYTE ? 'kilobyte' : 'megabyte',
    maximumFractionDigits: 1,
  }).format(bytes < MEGABYTE ? bytes / 1024 : bytes / MEGABYTE)

// The short name of a file type, e.g. JPEG for image/jpeg.
export const fileFormat = (type: string) => type.slice(type.indexOf('/') + 1).toUpperCase()
