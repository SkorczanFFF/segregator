import { Button, Divider, Group, SegmentedControl, Stack, Text } from '@mantine/core'
import { DatePicker, MonthPicker } from '@mantine/dates'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import classes from '~/features/documents/components/filters.module.css'
import ScrollRow from '~/features/documents/components/ScrollRow.tsx'
import { pickerRange, presetPeriod, PRESETS, samePeriod, type Period } from '~/features/documents/filters.ts'
import { toggle } from '~/features/documents/look.ts'

type PeriodPickerProps = {
  period?: Period
  onChange: (period?: Period) => void
  // On a phone the shortcuts are a row above the calendar, beside it otherwise.
  phone: boolean
}

// Picks whole months or days. The first pick applies at once as one month or day, and the second stretches it
// into a range. A shortcut sets whole months, or lifts the period.
export default function PeriodPicker({ period, onChange, phone }: PeriodPickerProps) {
  const { t, i18n } = useTranslation()
  const [unit, setUnit] = useState<Period['unit']>(period?.unit ?? 'month')
  const [range, setRange] = useState(() => pickerRange(period, period?.unit ?? 'month'))
  // Changes with a shortcut, so the calendar turns to its period.
  const [view, setView] = useState(0)

  function pick(value: [string | null, string | null]) {
    setRange(value)
    const [from, to] = value
    if (!from) return
    const cut = (day: string) => (unit === 'month' ? day.slice(0, 7) : day)
    onChange({ unit, from: cut(from), to: cut(to ?? from) })
  }

  // The period stays as it is; the calendar only shows it the other way.
  function switchUnit(value: string) {
    const next = value as Period['unit']
    setUnit(next)
    setRange(pickerRange(period, next))
  }

  function choose(next?: Period) {
    setUnit('month')
    setRange(pickerRange(next, 'month'))
    setView((count) => count + 1)
    onChange(next)
  }

  const shortcuts = [
    ...PRESETS.map((name) => ({ name, period: presetPeriod(name) })),
    { name: 'all' as const, period: undefined },
  ]
  const shortcutButtons = shortcuts.map(({ name, period: value }) => {
    const chosen = samePeriod(period, value)
    const label = t(`documents.filters.presets.${name}`)
    return phone ? (
      <Button key={name} size="sm" flex="none" {...toggle(chosen, 'brand')} onClick={() => choose(value)}>
        {label}
      </Button>
    ) : (
      <Button
        key={name}
        size="sm"
        px="sm"
        justify="flex-start"
        variant={chosen ? 'light' : 'subtle'}
        color={chosen ? 'brand' : 'gray'}
        aria-pressed={chosen}
        onClick={() => choose(value)}
      >
        {label}
      </Button>
    )
  })

  const calendar = {
    type: 'range' as const,
    allowSingleDateInRange: true,
    value: range,
    onChange: pick,
    locale: i18n.language,
    defaultDate: range[1] ?? range[0] ?? undefined,
    size: phone ? ('md' as const) : ('sm' as const),
  }

  const picker = (
    <Stack gap="sm">
      <SegmentedControl
        fullWidth
        value={unit}
        onChange={switchUnit}
        aria-label={t('documents.filters.unit')}
        data={[
          { value: 'month', label: t('documents.filters.months') },
          { value: 'day', label: t('documents.filters.days') },
        ]}
      />
      {phone && (
        <ScrollRow
          role="group"
          aria-label={t('documents.filters.presets.title')}
          className={`${classes.bleed} ${classes.inDrawer}`}
        >
          {shortcutButtons}
        </ScrollRow>
      )}
      <Group justify="center">
        {unit === 'month' ? (
          <MonthPicker key={view} {...calendar} />
        ) : (
          <DatePicker key={view} {...calendar} weekendDays={[]} />
        )}
      </Group>
      <Text size="xs" c="dimmed" maw={phone ? undefined : 260}>
        {t(unit === 'month' ? 'documents.filters.monthsHint' : 'documents.filters.daysHint')}
      </Text>
    </Stack>
  )

  if (phone) return picker
  return (
    <Group align="stretch" gap="md" wrap="nowrap">
      <Stack gap={2} w={180} role="group" aria-label={t('documents.filters.presets.title')}>
        {shortcutButtons}
      </Stack>
      <Divider orientation="vertical" />
      {picker}
    </Group>
  )
}
