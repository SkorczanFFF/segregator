import { Anchor, Group, Image, Paper, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { DocumentFile } from 'shared'
import { fileFormat, formatFileSize } from '~/shared/lib/format.ts'

// The document's file. A photo shows on the page, a PDF opens in a new tab.
// The API answers this address with a short-lived link to S3.
export default function FilePreview({ id, file }: { id: string; file: DocumentFile }) {
  const { t } = useTranslation()
  const src = `/api/documents/${id}/file`

  return (
    <Paper>
      <Stack gap="sm">
        {file.type !== 'application/pdf' && (
          <Image src={src} alt={t('documents.photo')} mah={480} fit="contain" radius="sm" />
        )}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {t('documents.file', { format: fileFormat(file.type), size: formatFileSize(file.size) })}
          </Text>
          <Anchor href={src} target="_blank" rel="noopener" size="sm" fw={600}>
            {t('documents.openFile')}
          </Anchor>
        </Group>
      </Stack>
    </Paper>
  )
}
