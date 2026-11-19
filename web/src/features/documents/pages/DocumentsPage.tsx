import { Button, Divider, Group, Paper, Skeleton, Stack, Text, Title, UnstyledButton } from '@mantine/core'
import { IconChevronRight, IconFileText, IconFilterOff, IconPlus } from '@tabler/icons-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import type { Document } from 'shared'
import decor from '~/app/decor.module.css'
import { useSession } from '~/features/auth/session.ts'
import DocumentFilters from '~/features/documents/components/DocumentFilters.tsx'
import DocumentSummary from '~/features/documents/components/DocumentSummary.tsx'
import classes from '~/features/documents/components/documents.module.css'
import { apiQuery, hasFilter, readFilter, writeFilter } from '~/features/documents/filters.ts'
import { CARD_INSET } from '~/features/documents/look.ts'
import { useDocuments } from '~/features/documents/useDocuments.ts'
import Page from '~/shared/components/Page.tsx'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import { formatMonthName } from '~/shared/lib/format.ts'

// The list comes newest first, so the documents of one month follow each other.
function byMonth(items: Document[]) {
  const months: { month: string; docs: Document[] }[] = []
  for (const doc of items) {
    const month = doc.docDate.slice(0, 7)
    const last = months.at(-1)
    if (last?.month === month) last.docs.push(doc)
    else months.push({ month, docs: [doc] })
  }
  return months
}

function DocumentRow({ doc }: { doc: Document }) {
  return (
    <UnstyledButton
      component={Link}
      to={`/documents/${doc.id}`}
      py="sm"
      px={CARD_INSET}
      className={classes.row}
    >
      <Group wrap="nowrap" gap="md">
        {/* The year is in the month's heading, so the date is short. */}
        <DocumentSummary doc={doc} shortDate />
        <IconChevronRight size={18} aria-hidden className={classes.chevron} />
      </Group>
    </UnstyledButton>
  )
}

export default function DocumentsPage() {
  const { t } = useTranslation()
  // The filter lives in the address, so a filtered list can be refreshed or shared, and going back undoes a change.
  const [params, setParams] = useSearchParams()
  const filter = readFilter(params)
  const filtered = hasFilter(filter)
  const { items, summary, error, hasMore, loadMore, loadingMore, updating } = useDocuments(apiQuery(filter))
  const { user } = useSession()
  const clear = () => setParams(new URLSearchParams())

  return (
    <Page
      title={t('documents.title')}
      // On a phone adding a document is in the menu at the bottom.
      actions={
        !user?.demo && (
          <Button
            component={Link}
            to="/documents/new"
            leftSection={<IconPlus size={18} aria-hidden />}
            visibleFrom="sm"
            className={decor.stamp}
          >
            {t('documents.add')}
          </Button>
        )
      }
    >
      <ApiErrorAlert code={error} />
      {/* An account without documents has nothing to filter yet. */}
      {(filtered || items?.length !== 0) && (
        <DocumentFilters filter={filter} onChange={(next) => setParams(writeFilter(next))} summary={summary} />
      )}
      {!items && !error && (
        <Paper p="xl" aria-busy>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} h={40} my="sm" />
          ))}
        </Paper>
      )}
      {items?.length === 0 && (
        <Paper p="xl">
          <Stack align="center" gap="xs" ta="center">
            {filtered ? <IconFilterOff size={32} stroke={1.5} aria-hidden /> : <IconFileText size={32} stroke={1.5} aria-hidden />}
            <Text fw={600}>{filtered ? t('documents.filters.none') : t('documents.empty')}</Text>
            <Text size="sm" c="dimmed">
              {filtered ? t('documents.filters.noneHint') : t('documents.emptyHint')}
            </Text>
            {filtered && (
              <Button variant="light" mt="xs" onClick={clear}>
                {t('documents.filters.clear')}
              </Button>
            )}
          </Stack>
        </Paper>
      )}
      {items && items.length > 0 && (
        // Under a new filter the previous list fades until the new one comes.
        <Stack gap="lg" opacity={updating ? 0.5 : 1} aria-busy={updating}>
          {byMonth(items).map(({ month, docs }) => (
            <Stack key={month} gap={0}>
              <Title order={2} size="h4" className={classes.monthTab}>
                <Text span inherit tt="capitalize">
                  {formatMonthName(month)}
                </Text>{' '}
                <Text span ff="monospace" fz="xs" fw={500} c="dimmed">
                  {month.slice(0, 4)}
                </Text>
              </Title>
              <Paper className={`${classes.card} ${classes.underTab}`}>
                {docs.map((doc, index) => (
                  <Fragment key={doc.id}>
                    {index > 0 && <Divider />}
                    <DocumentRow doc={doc} />
                  </Fragment>
                ))}
              </Paper>
            </Stack>
          ))}
        </Stack>
      )}
      {items && hasMore && (
        <Stack gap="xs">
          {summary && (
            <Text size="sm" c="dimmed" ta="center">
              {t('documents.filters.shown', { shown: items.length, count: summary.count })}
            </Text>
          )}
          <Button variant="light" loading={loadingMore} onClick={() => void loadMore()}>
            {t('documents.loadMore')}
          </Button>
        </Stack>
      )}
    </Page>
  )
}
