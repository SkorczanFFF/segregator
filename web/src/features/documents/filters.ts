import { DOCUMENT_TYPES, DocumentFilter, isSubtypeOf, type DocumentType, type Subtype } from 'shared'
import { formatDays, formatMonths } from '~/shared/lib/format.ts'

// A period picked as whole months, e.g. 2026-09 to 2026-11, or as days, e.g. 2026-11-03 to 2026-11-16.
export type Period = { unit: 'month' | 'day'; from: string; to: string }

// The list's filter as the page holds it. No types means every type.
export type ListFilter = { period?: Period; types: DocumentType[]; subtype?: Subtype }

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

// A day as the API takes it.
const isDay = (value: string) => DocumentFilter.shape.from.safeParse(value).success

const unitOf = (value: string) => (MONTH.test(value) ? 'month' : isDay(value) ? 'day' : undefined)

// The filter from the address, e.g. ?from=2026-09&to=2026-11&types=receipt,invoice or ?types=receipt&subtype=fuel,
// where a month stands for the whole of it. What doesn't hold up is left out, so an edited address still opens
// the list.
export function readFilter(params: URLSearchParams): ListFilter {
  const listed = params.get('types')?.split(',') ?? []
  const types = DOCUMENT_TYPES.filter((type) => listed.includes(type))
  const [from, to] = [params.get('from') ?? '', params.get('to') ?? '']
  const unit = unitOf(from)
  const subtype = params.get('subtype') ?? ''
  const [only] = types
  return {
    period: unit && unitOf(to) === unit && from <= to ? { unit, from, to } : undefined,
    types,
    subtype: only && types.length === 1 && isSubtypeOf(only, subtype) ? subtype : undefined,
  }
}

export function writeFilter({ period, types, subtype }: ListFilter) {
  const params = new URLSearchParams()
  if (period) {
    params.set('from', period.from)
    params.set('to', period.to)
  }
  if (types.length > 0) params.set('types', types.join(','))
  if (subtype) params.set('subtype', subtype)
  return params
}

export const hasFilter = ({ period, types }: ListFilter) => period !== undefined || types.length > 0

// The last day of a month such as 2026-02, e.g. 2026-02-28.
const lastDay = (month: string) => {
  const [year = 0, number = 0] = month.split('-').map(Number)
  return `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}`
}

// The filter as the API takes it, in days: a whole month runs from its first day to its last.
export function apiQuery({ period, types, subtype }: ListFilter) {
  const params = new URLSearchParams()
  if (period) {
    params.set('from', period.unit === 'month' ? `${period.from}-01` : period.from)
    params.set('to', period.unit === 'month' ? lastDay(period.to) : period.to)
  }
  if (types.length > 0) params.set('types', types.join(','))
  if (subtype) params.set('subtype', subtype)
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
