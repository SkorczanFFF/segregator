import i18n from 'i18next'

// Amounts are stored in grosze. Compact notation shortens large ones, e.g. 10 mln zł.
export const formatMoney = (grosze: number, notation: Intl.NumberFormatOptions['notation'] = 'standard') =>
  new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'PLN', notation }).format(grosze / 100)

// A date from a document has no time zone, so it is formatted in UTC to keep the same day everywhere.
export const formatDate = (isoDate: string) =>
  new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(isoDate))

export const formatFileSize = (bytes: number) =>
  new Intl.NumberFormat(i18n.language, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(
    bytes / 1024 / 1024,
  )

// The short name of a file type, e.g. JPEG for image/jpeg.
export const fileFormat = (type: string) => type.slice(type.indexOf('/') + 1).toUpperCase()
