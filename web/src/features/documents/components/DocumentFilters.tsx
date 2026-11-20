import { ActionIcon, Box, Button, Divider, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconCheck, IconDownload } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CATEGORIES, DOCUMENT_TYPES, type DocumentType, type ListSummary } from 'shared'
import classes from '~/features/documents/components/filters.module.css'
import PeriodControl from '~/features/documents/components/PeriodControl.tsx'
import ScrollRow from '~/features/documents/components/ScrollRow.tsx'
import { documentsCsv, saveFile } from '~/features/documents/csv.ts'
import { apiQuery, hasFilter, singleType, typesOf, type ListFilter } from '~/features/documents/filters.ts'
import { toggle, TYPE_LOOKS } from '~/features/documents/look.ts'
import { fetchAllDocuments } from '~/features/documents/useDocuments.ts'
import { useMenuCategories } from '~/features/documents/useMenuCategories.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { formatMoney } from '~/shared/lib/format.ts'

type DocumentFiltersProps = {
  filter: ListFilter
  onChange: (filter: ListFilter) => void
  summary?: ListSummary
}

// The period, the types and, with one type chosen, its subcategories, over the whole filtered list counted and
// added up. In a category, while the side menu shows the categories, its subcategories take the place of the
// types. On a wider screen all of it sticks under the header as the list scrolls; on a phone the row of the
// period and the types does.
export default function DocumentFilters({ filter, onChange, summary }: DocumentFiltersProps) {
  const { t } = useTranslation()
  const theme = useMantineTheme()
  // Below the sm breakpoint, where the menu moves to the bottom of the screen.
  const phone = !useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, true, { getInitialValueInEffect: false })
  const [menuCategories] = useMenuCategories()
  const anchor = useRef<HTMLDivElement>(null)
  const exporting = useApiSubmit(async () => {
    const docs = await fetchAllDocuments(apiQuery(filter))
    saveFile(`segregator-${dayjs().format('YYYY-MM-DD')}.csv`, documentsCsv(t, docs), 'text/csv;charset=utf-8')
  })

  // A change made while the filters stick starts the list again right under them.
  function change(next: ListFilter) {
    onChange(next)
    const start = anchor.current
    if (start && start.getBoundingClientRect().top < parseFloat(getComputedStyle(start).scrollMarginTop)) {
      start.scrollIntoView({ block: 'start' })
    }
  }

  const { category } = filter
  const typesShown = !category || phone || !menuCategories
  const chosenTypes = typesOf(filter)

  // A type pressed or released goes on in the whole list, with the period. A subcategory belongs to the one type
  // it was picked with.
  const toggleType = (type: DocumentType) =>
    change({
      period: filter.period,
      types: chosenTypes.includes(type)
        ? chosenTypes.filter((chosen) => chosen !== type)
        : DOCUMENT_TYPES.filter((each) => each === type || chosenTypes.includes(each)),
    })

  const only = singleType(filter)
  const subtypes = only ? CATEGORIES[only] : []
  // The buttons beside the period, as large as it is.
  const main = { size: 'sm', h: phone ? 40 : undefined, px: 'sm' } as const

  const period = (
    <PeriodControl period={filter.period} onChange={(next) => change({ ...filter, period: next })} phone={phone} />
  )

  const typeButtons = DOCUMENT_TYPES.map((type) => {
    const chosen = chosenTypes.includes(type)
    return (
      <Button
        key={type}
        {...main}
        flex="none"
        {...toggle(chosen, TYPE_LOOKS[type].color)}
        leftSection={chosen && <IconCheck size={14} stroke={2.5} aria-hidden />}
        onClick={() => toggleType(type)}
      >
        {t(`categories.types.${type}`)}
      </Button>
    )
  })

  const subtypeButtons =
    only &&
    subtypes.map((subtype) => {
      const chosen = subtype === filter.subtype
      return (
        <Button
          key={subtype}
          {...(typesShown ? { size: phone ? 'sm' : 'compact-sm' } : main)}
          flex="none"
          {...toggle(chosen, TYPE_LOOKS[only].color)}
          onClick={() => change({ ...filter, subtype: chosen ? undefined : subtype })}
        >
          {t(`categories.subtypes.${subtype}`)}
        </Button>
      )
    })
  const subtypesLabel = t('documents.fields.subtype')

  // Beside the period: the types, or in their place the category's subcategories, which Other has none of.
  const choices = (typesShown || subtypes.length > 0) && (
    <Group
      gap={6}
      wrap={phone ? 'nowrap' : 'wrap'}
      // Beside the period while they have room, under it on a narrow screen.
      flex={phone ? 'none' : '1 1 320px'}
      role="group"
      aria-label={typesShown ? t('documents.fields.type') : subtypesLabel}
    >
      {typesShown ? typeButtons : subtypeButtons}
    </Group>
  )

  // The subcategories of the one type, in a row under the period and the types.
  const subtypeRow = typesShown && subtypes.length > 0 && subtypeButtons

  const totals = (
    <Group justify="space-between" gap="xs" wrap="nowrap">
      <Text size="sm" miw={0} aria-live="polite">
        {summary && (
          <>
            <Text span inherit fw={700}>
              {t('documents.filters.count', { count: summary.count })}
            </Text>
            <Text span inherit c="dimmed">
              {phone ? ' · ' : ` · ${t('documents.filters.total')} `}
            </Text>
            <Text span inherit ff="monospace" fw={500}>
              {formatMoney(summary.total)}
            </Text>
          </>
        )}
      </Text>
      <Group gap={4} wrap="nowrap" flex="none">
        {hasFilter(filter) && (
          <Button
            variant="subtle"
            size={phone ? 'sm' : 'compact-sm'}
            h={phone ? 40 : 30}
            onClick={() => change({ category, types: [] })}
          >
            {phone ? t('documents.filters.clearShort') : t('documents.filters.clear')}
          </Button>
        )}
        {phone ? (
          <ActionIcon
            variant="default"
            size={40}
            aria-label={t('documents.filters.export')}
            loading={exporting.pending}
            disabled={!summary?.count}
            onClick={() => void exporting.submit(undefined)}
          >
            <IconDownload size={18} aria-hidden />
          </ActionIcon>
        ) : (
          <Button
            variant="default"
            size="compact-sm"
            h={30}
            leftSection={<IconDownload size={16} aria-hidden />}
            loading={exporting.pending}
            disabled={!summary?.count}
            onClick={() => void exporting.submit(undefined)}
          >
            {t('documents.filters.export')}
          </Button>
        )}
      </Group>
    </Group>
  )

  if (phone) {
    return (
      <>
        <div ref={anchor} className={classes.anchor} />
        <section aria-label={t('documents.filters.title')} className={classes.sticky}>
          <ScrollRow nudge className={classes.bleed}>
            {period}
            {choices && (
              <>
                <Divider orientation="vertical" my={8} />
                {choices}
              </>
            )}
          </ScrollRow>
        </section>
        <Stack gap="xs" className={classes.under}>
          {subtypeRow && (
            <ScrollRow role="group" aria-label={subtypesLabel} className={classes.bleed}>
              {subtypeRow}
            </ScrollRow>
          )}
          {totals}
          <ApiErrorAlert code={exporting.error} />
        </Stack>
      </>
    )
  }

  return (
    <>
      <div ref={anchor} className={classes.anchor} />
      <div className={classes.sticky}>
        <Paper component="section" aria-label={t('documents.filters.title')}>
          <Stack gap="sm" px="md" py="sm">
            <Group gap="sm" align="flex-start">
              {period}
              {choices}
            </Group>
            {subtypeRow && (
              <Group gap={6} role="group" aria-label={subtypesLabel}>
                {subtypeRow}
              </Group>
            )}
          </Stack>
          <Divider />
          <Box pl="md" pr={6} py={6}>
            {totals}
          </Box>
        </Paper>
      </div>
      <ApiErrorAlert code={exporting.error} />
    </>
  )
}
