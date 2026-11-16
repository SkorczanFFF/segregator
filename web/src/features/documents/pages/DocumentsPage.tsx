import {
  Button,
  Divider,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
  type MantineColor,
} from '@mantine/core'
import {
  IconBolt,
  IconCertificate,
  IconChevronRight,
  IconFileInvoice,
  IconFileText,
  IconPaperclip,
  IconPlus,
  IconReceipt,
  IconShieldCheck,
  IconSignature,
  type Icon,
} from '@tabler/icons-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Document, DocumentType, Subtype } from 'shared'
import { useDocuments } from '~/features/documents/useDocuments.ts'
import Page from '~/shared/components/Page.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { formatDate, formatMoney, formatMonth } from '~/shared/lib/format.ts'

// Each type has its icon and one of a few colors, so the list reads at a glance.
const TYPE_LOOKS = {
  receipt: { icon: IconReceipt, color: 'brand' },
  bill: { icon: IconBolt, color: 'brand' },
  invoice: { icon: IconFileInvoice, color: 'saffron' },
  warranty: { icon: IconCertificate, color: 'saffron' },
  policy: { icon: IconShieldCheck, color: 'cyan' },
  contract: { icon: IconSignature, color: 'cyan' },
  other: { icon: IconFileText, color: 'gray' },
} satisfies Record<DocumentType, { icon: Icon; color: MantineColor }>

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
  const { t } = useTranslation()
  const { icon: TypeIcon, color } = TYPE_LOOKS[doc.type]
  const details = [
    formatDate(doc.docDate),
    t(`categories.types.${doc.type}`),
    doc.subtype && t(`categories.subtypes.${doc.subtype as Subtype}`),
    doc.title && doc.issuer,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <UnstyledButton component={Link} to={`/documents/${doc.id}`} display="block" py="sm">
      <Group wrap="nowrap" gap="md">
        <ThemeIcon variant="light" color={color} size={40} radius="md">
          <TypeIcon size={20} aria-hidden />
        </ThemeIcon>
        <Stack gap={2} flex={1} miw={0}>
          <Text fw={600} truncate>
            {doc.title ?? doc.issuer}
          </Text>
          <Text size="sm" c="dimmed" truncate>
            {details}
          </Text>
        </Stack>
        {doc.amount !== undefined && (
          <Text ff="monospace" size="sm" flex="none">
            {formatMoney(doc.amount)}
          </Text>
        )}
        {doc.file && <IconPaperclip size={16} role="img" aria-label={t('documents.hasFile')} />}
        <IconChevronRight size={18} aria-hidden style={{ flex: 'none' }} />
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
      actions={
        <Button component={Link} to="/documents/new" leftSection={<IconPlus size={18} aria-hidden />}>
          {t('documents.add')}
        </Button>
      }
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
            <Paper px="xl" py="xs">
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
    </Page>
  )
}
