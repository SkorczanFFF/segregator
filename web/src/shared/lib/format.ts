import i18n from 'i18next'

// Amounts are stored in grosze.
export const formatMoney = (grosze: number) =>
  new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'PLN' }).format(grosze / 100)

// A date from a document has no time zone, so it is formatted in UTC to keep the same day everywhere.
export const formatDate = (isoDate: string) =>
  new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(isoDate))
