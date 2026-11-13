import { Alert, Button, Divider, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core'
import { IconFileText } from '@tabler/icons-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { Document, Subtype } from 'shared'
import { useDocuments } from '~/features/documents/useDocuments.ts'
import { formatDate, formatMoney } from '~/shared/lib/format.ts'

function DocumentRow({ doc }: { doc: Document }) {
  const { t } = useTranslation()
  const category = [
    t(`categories.types.${doc.type}`),
    doc.subtype && t(`categories.subtypes.${doc.subtype as Subtype}`),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Group wrap="nowrap" gap="md" py="sm" align="flex-start">
      <Text ff="monospace" size="sm" c="dimmed" w={104} style={{ flex: 'none' }}>
        {formatDate(doc.docDate)}
      </Text>
      <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
        <Text fw={600} truncate>
          {doc.title ?? doc.issuer}
        </Text>
        <Text size="sm" c="dimmed" truncate>
          {doc.title ? `${category} · ${doc.issuer}` : category}
        </Text>
      </Stack>
      {doc.amount !== undefined && (
        <Text ff="monospace" size="sm" style={{ flex: 'none' }}>
          {formatMoney(doc.amount)}
        </Text>
      )}
    </Group>
  )
}

export default function DocumentsPage() {
  const { t } = useTranslation()
  const { items, error, hasMore, loadMore, loadingMore } = useDocuments()

  return (
    <Stack gap="lg" maw={880}>
      <Title>{t('documents.title')}</Title>
      {error && <Alert color="red">{t(`errors.${error}`)}</Alert>}
      {!items && !error && (
        <Paper aria-busy>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} h={40} my="sm" />
          ))}
        </Paper>
      )}
      {items?.length === 0 && (
        <Paper>
          <Stack align="center" gap="xs" ta="center">
            <IconFileText size={32} stroke={1.5} aria-hidden />
            <Text fw={600}>{t('documents.empty')}</Text>
            <Text size="sm" c="dimmed">
              {t('documents.emptyHint')}
            </Text>
          </Stack>
        </Paper>
      )}
      {items && items.length > 0 && (
        <Paper py="xs">
          {items.map((doc, index) => (
            <Fragment key={doc.id}>
              {index > 0 && <Divider />}
              <DocumentRow doc={doc} />
            </Fragment>
          ))}
        </Paper>
      )}
      {hasMore && (
        <Button variant="light" loading={loadingMore} onClick={() => void loadMore()}>
          {t('documents.loadMore')}
        </Button>
      )}
    </Stack>
  )
}
