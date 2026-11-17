import {
  Affix,
  Badge,
  Box,
  Button,
  Divider,
  getDefaultZIndex,
  Group,
  Indicator,
  Loader,
  Paper,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
  VisuallyHidden,
  type ButtonProps,
} from '@mantine/core'
import { IconChevronRight, IconFileText, IconPaperclip, IconPlus } from '@tabler/icons-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Document } from 'shared'
import classes from '~/features/documents/components/documents.module.css'
import { CARD_INSET, describeDocument, documentName, TYPE_LOOKS } from '~/features/documents/look.ts'
import { isPending, useDocuments } from '~/features/documents/useDocuments.ts'
import Page from '~/shared/components/Page.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { formatDate, formatDayMonth, formatMoney, formatMonth } from '~/shared/lib/format.ts'

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

function AddButton(props: ButtonProps) {
  const { t } = useTranslation()
  return (
    <Button component={Link} to="/documents/new" leftSection={<IconPlus size={18} aria-hidden />} {...props}>
      {t('documents.add')}
    </Button>
  )
}

function DocumentRow({ doc }: { doc: Document }) {
  const { t } = useTranslation()
  const { icon: TypeIcon, color } = TYPE_LOOKS[doc.type]

  return (
    <UnstyledButton
      component={Link}
      to={`/documents/${doc.id}`}
      py="sm"
      px={CARD_INSET}
      className={classes.row}
    >
      <Group wrap="nowrap" gap="md">
        <Indicator
          disabled={!doc.file}
          size={20}
          offset={4}
          position="bottom-end"
          withBorder
          label={<IconPaperclip size={12} stroke={2.5} role="img" aria-label={t('documents.hasFile')} />}
        >
          <ThemeIcon variant="light" color={color} size={44} radius="md">
            <TypeIcon size={32} stroke={1.5} aria-hidden />
          </ThemeIcon>
        </Indicator>
        <Stack gap={2} flex={1} miw={0}>
          <Text fw={600} truncate>
            {documentName(doc)}
          </Text>
          {/* The status goes before the category, so a phone still has room for the name. */}
          <Group gap="xs" wrap="nowrap">
            {doc.status !== 'done' && (
              <Badge
                size="sm"
                variant="light"
                color={doc.status === 'failed' ? 'red' : 'gray'}
                leftSection={isPending(doc) && <Loader size={10} color="currentColor" aria-hidden />}
                flex="none"
              >
                {t(`documents.status.${doc.status}`)}
              </Badge>
            )}
            <Text size="sm" c="dimmed" truncate>
              {describeDocument(t, doc).join(' · ')}
            </Text>
          </Group>
        </Stack>
        {/* The year is in the month's heading, so the date is short. */}
        <Stack gap={2} align="flex-end" flex="none">
          {doc.amount !== undefined && (
            <Text ff="monospace" size="sm">
              {formatMoney(doc.amount)}
            </Text>
          )}
          <Text ff="monospace" size="xs" c="dimmed">
            <span aria-hidden>{formatDayMonth(doc.docDate)}</span>
            <VisuallyHidden>{formatDate(doc.docDate)}</VisuallyHidden>
          </Text>
        </Stack>
        <IconChevronRight size={18} aria-hidden className={classes.chevron} />
      </Group>
    </UnstyledButton>
  )
}

export default function DocumentsPage() {
  const { t } = useTranslation()
  const { items, error, hasMore, loadMore, loadingMore } = useDocuments()

  return (
    <Page
      title={t('documents.title')}
      actions={<AddButton visibleFrom="sm" />}
    >
      {error && <StatusAlert status="error">{t(`errors.${error}`)}</StatusAlert>}
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
            <IconFileText size={32} stroke={1.5} aria-hidden />
            <Text fw={600}>{t('documents.empty')}</Text>
            <Text size="sm" c="dimmed">
              {t('documents.emptyHint')}
            </Text>
          </Stack>
        </Paper>
      )}
      {items &&
        byMonth(items).map(({ month, docs }) => (
          <Stack key={month} gap="xs">
            <Title order={2} size="h4" tt="capitalize">
              {formatMonth(month)}
            </Title>
            <Paper className={classes.card}>
              {docs.map((doc, index) => (
                <Fragment key={doc.id}>
                  {index > 0 && <Divider />}
                  <DocumentRow doc={doc} />
                </Fragment>
              ))}
            </Paper>
          </Stack>
        ))}
      {hasMore && (
        <Button variant="light" loading={loadingMore} onClick={() => void loadMore()}>
          {t('documents.loadMore')}
        </Button>
      )}
      {/* On a phone the add button floats in the corner, below the app shell so the open menu covers it.
          The empty box keeps it off the end of the list. */}
      <Affix hiddenFrom="sm" position={{ bottom: 16, right: 16 }} zIndex={getDefaultZIndex('app') - 1}>
        <AddButton size="lg" className={classes.fab} />
      </Affix>
      <Box h={40} hiddenFrom="sm" />
    </Page>
  )
}
