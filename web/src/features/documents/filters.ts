import type { Location } from 'react-router'
import { DOCUMENT_TYPES, DocumentFilter, isSubtypeOf, type DocumentType, type Subtype } from 'shared'
import { formatDays, formatMonths } from '~/shared/lib/format.ts'

// A period picked as whole months, e.g. 2026-09 to 2026-11, or as days, e.g. 2026-11-03 to 2026-11-16.
export type Period = { unit: 'month' | 'day'; from: string; to: string }

// The list's filter as the page holds it. A category is a list of one type from the menu, and the types are
// chosen only outside one, where none means every type.
export type ListFilter = { category?: DocumentType; period?: Period; types: DocumentType[]; subtype?: Subtype }

// The whole list's path, or a category's, e.g. /documents/receipt.
export const listPath = (category?: DocumentType) => (category ? `/documents/${category}` : '/documents')

// The category a list's address shows, e.g. receipt for /documents/receipt?subtype=fuel.
export function categoryOf(address: string) {
  const [path] = address.split('?')
  return DOCUMENT_TYPES.find((type) => path === listPath(type))
}

export const isList = (pathname: string) => pathname === listPath() || categoryOf(pathname) !== undefined

// The list a page belongs to: a list itself, or for a document the list it was opened from, which the link
// carries in its state. Without one, the whole list.
export function listOf({ pathname, search, state }: Location) {
  if (isList(pathname)) return pathname + search
  const list: unknown = (state as { list?: unknown } | null)?.list
  return typeof list === 'string' ? list : listPath()
}

// The state of a link to a document, so its page can go back to the list with its filters.
export const fromList = (location: Location) => ({ list: listOf(location) })

// The types the list shows: the category's one, or those chosen, where none means every type.
export const typesOf = ({ category, types }: Pick<ListFilter, 'category' | 'types'>) => (category ? [category] : types)

// The one type the list shows, whose subcategories can narrow it.
export function singleType(filter: Pick<ListFilter, 'category' | 'types'>) {
  const types = typesOf(filter)
  return types.length === 1 ? types[0] : undefined
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

// A day as the API takes it.
const isDay = (value: string) => DocumentFilter.shape.from.safeParse(value).success

const unitOf = (value: string) => (MONTH.test(value) ? 'month' : isDay(value) ? 'day' : undefined)

// The filter from the address: the category from the path, the rest from the query, e.g.
// ?from=2026-09&to=2026-11&types=receipt,invoice or ?types=receipt&subtype=fuel, where a month stands for the
// whole of it. In a category the types are left out. What doesn't hold up is left out too, so an edited address
// still opens the list.
export function readFilter(params: URLSearchParams, category?: DocumentType): ListFilter {
  const listed = category ? [] : (params.get('types')?.split(',') ?? [])
  const types = DOCUMENT_TYPES.filter((type) => listed.includes(type))
  const [from, to] = [params.get('from') ?? '', params.get('to') ?? '']
  const unit = unitOf(from)
  const subtype = params.get('subtype') ?? ''
  const only = singleType({ category, types })
  return {
    category,
    period: unit && unitOf(to) === unit && from <= to ? { unit, from, to } : undefined,
    types,
    subtype: only && isSubtypeOf(only, subtype) ? subtype : undefined,
  }
}

// The list's address: the category's path or the whole list's, and the rest in the query.
export function listAddress({ category, period, types, subtype }: ListFilter) {
  const params = new URLSearchParams()
  if (period) {
    params.set('from', period.from)
    params.set('to', period.to)
  }
  if (types.length > 0) params.set('types', types.join(','))
  if (subtype) params.set('subtype', subtype)
  const query = params.toString()
  return query ? `${listPath(category)}?${query}` : listPath(category)
}

// Whether anything narrows the list beyond its category.
export const hasFilter = ({ period, types, subtype }: ListFilter) =>
  period !== undefined || types.length > 0 || subtype !== undefined

// The last day of a month such as 2026-02, e.g. 2026-02-28.
const lastDay = (month: string) => {
  const [year = 0, number = 0] = month.split('-').map(Number)
  return `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}`
}

// The filter as the API takes it, in days: a whole month runs from its first day to its last.
export function apiQuery(filter: ListFilter) {
  const { period } = filter
  const params = new URLSearchParams()
  if (period) {
    params.set('from', period.unit === 'month' ? `${period.from}-01` : period.from)
    params.set('to', period.unit === 'month' ? lastDay(period.to) : period.to)
  }
  const types = typesOf(filter)
  if (types.length > 0) params.set('types', types.join(','))
  if (filter.subtype) params.set('subtype', filter.subtype)
  return params.toString()
}

export const formatPeriod = ({ unit, from, to }: Period) =>
  unit === 'month' ? formatMonths(from, to) : formatDays(from, to)

// The period as Mantine's pickers take it, in days: a month as its first day, or whole months spread over
// their days for the picker of days.
export function pickerRange(period: Period | undefined, unit: Period['unit']): [string | null, string | null] {
  if (!period) return [null, null]
  if (unit === 'month') return [`${period.from.slice(0, 7)}-01`, `${period.to.slice(0, 7)}-01`]
  return period.unit === 'day' ? [period.from, period.to] : [`${period.from}-01`, lastDay(period.to)]
}

export const PRESETS = ['thisMonth', 'previousMonth', 'lastThreeMonths', 'thisYear', 'previousYear'] as const

export type Preset = (typeof PRESETS)[number]

// A month counted from the current one, e.g. -1 for the one before, as 2026-10.
const monthAway = (today: Date, offset: number) => {
  const month = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
}

// A shortcut's period, always whole months.
export function presetPeriod(preset: Preset, today = new Date()): Period {
  const year = today.getFullYear()
  const ranges: Record<Preset, [string, string]> = {
    thisMonth: [monthAway(today, 0), monthAway(today, 0)],
    previousMonth: [monthAway(today, -1), monthAway(today, -1)],
    lastThreeMonths: [monthAway(today, -2), monthAway(today, 0)],
    thisYear: [`${year}-01`, `${year}-12`],
    previousYear: [`${year - 1}-01`, `${year - 1}-12`],
  }
  const [from, to] = ranges[preset]
  return { unit: 'month', from, to }
}

export const samePeriod = (a?: Period, b?: Period) =>
  a?.unit === b?.unit && a?.from === b?.from && a?.to === b?.to
