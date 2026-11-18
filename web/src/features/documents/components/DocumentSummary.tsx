import { Group, Indicator, Stack, Text, ThemeIcon, VisuallyHidden } from '@mantine/core'
import { IconPaperclip } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { Document } from 'shared'
import { describeDocument, documentName, TYPE_LOOKS } from '~/features/documents/look.ts'
import { formatDate, formatDayMonth, formatMoney } from '~/shared/lib/format.ts'

// A document at a glance: its type's tile, marked when it has a file, its name and what it is, its amount and
// date. A short date shows only the day and month, where the year is said around it.
export default function DocumentSummary({ doc, shortDate = false }: { doc: Document; shortDate?: boolean }) {
  const { t } = useTranslation()
  const { icon: TypeIcon, color } = TYPE_LOOKS[doc.type]

  return (
    <Group wrap="nowrap" gap="md" flex={1} miw={0}>
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
        <Text size="sm" c="dimmed" truncate>
          {describeDocument(t, doc)}
        </Text>
      </Stack>
      <Stack gap={2} align="flex-end" flex="none">
        {doc.amount !== undefined && (
          <Text ff="monospace" size="sm">
            {formatMoney(doc.amount)}
          </Text>
        )}
        <Text ff="monospace" size="xs" c="dimmed">
          {shortDate ? (
            <>
              <span aria-hidden>{formatDayMonth(doc.docDate)}</span>
              <VisuallyHidden>{formatDate(doc.docDate)}</VisuallyHidden>
            </>
          ) : (
            formatDate(doc.docDate)
          )}
        </Text>
      </Stack>
    </Group>
  )
}
