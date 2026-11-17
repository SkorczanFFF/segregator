import { Box, Button, Divider, Flex, Group, Loader, Progress, Stack, Text } from '@mantine/core'
import { IconCheck, IconSparkles } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Document, DocumentRead, Draft } from 'shared'
import decor from '~/app/decor.module.css'
import { CARD_INSET } from '~/features/documents/look.ts'
import { isReading, readDocument, useReadUse } from '~/features/documents/useDocuments.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { errorCode } from '~/shared/lib/api.ts'

type ReadPanelProps = {
  doc: Document | Draft
  // How a reading watched from the page ended. Without it the panel offers a reading.
  outcome?: DocumentRead['status']
}

// Reads the document's file with the model, with the readings left this month. It stands at the top of the
// fields, which the reading fills.
export default function ReadPanel({ doc, outcome }: ReadPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const use = useReadUse()
  const read = useApiSubmit(() => readDocument(queryClient, doc.id))
  const reading = isReading(doc)
  // Why no reading can start, which takes the place of the hint. The API keeps the limits anyway, so the button
  // needn't wait for the counter.
  const blocked =
    doc.file?.pages !== 1
      ? t('documents.read.pages')
      : use.data?.left === 0
        ? t('documents.read.limit', { limit: use.data.limit })
        : use.data && !use.data.open
          ? t('documents.read.closed')
          : undefined
  const counter = use.data && !blocked && (
    <Text size="sm" c="dimmed">
      {t('documents.read.left', use.data)}
    </Text>
  )
  const start = (label: string, variant: 'filled' | 'subtle') => (
    <Button
      variant={variant}
      color="saffron"
      leftSection={<IconSparkles size={18} aria-hidden />}
      loading={read.pending}
      disabled={Boolean(blocked)}
      // The reading offered first is the panel's main action.
      className={variant === 'filled' ? `${decor.stamp} ${decor.stampOnSaffron}` : undefined}
      onClick={() => void read.submit(undefined)}
    >
      {label}
    </Button>
  )

  return (
    <Box bg="color-mix(in srgb, var(--mantine-color-saffron-filled) 7%, transparent)">
      <Stack gap="sm" px={CARD_INSET} py="md">
        {reading ? (
          <Stack gap={8} role="status">
            <Group gap="sm">
              <Loader size="sm" color="saffron" aria-hidden />
              <Text fw={600}>{t('documents.read.reading')}</Text>
            </Group>
            <Progress value={100} animated striped color="saffron" size="xs" aria-hidden />
            <Text size="sm">{t('documents.read.wait')}</Text>
          </Stack>
        ) : outcome === 'done' ? (
          // On a phone the button goes under the message, which would otherwise wrap into a narrow column.
          <Flex
            direction={{ base: 'column', sm: 'row' }}
            align={{ base: 'flex-start', sm: 'center' }}
            gap="xs"
            role="status"
          >
            <Group gap="sm" wrap="nowrap" align="flex-start" flex={1}>
              <IconCheck size={20} color="var(--mantine-color-saffron-filled)" aria-hidden style={{ flex: 'none' }} />
              <Text size="sm">{t(doc.draft ? 'documents.read.done' : 'documents.read.doneSaved')}</Text>
            </Group>
            {start(t('documents.read.again'), 'subtle')}
          </Flex>
        ) : outcome === 'failed' ? (
          <>
            <StatusAlert status="warning">{t('documents.read.failed')}</StatusAlert>
            {start(t('documents.read.retry'), 'subtle')}
          </>
        ) : (
          <>
            {start(t(doc.read ? 'documents.read.again' : 'documents.read.start'), 'filled')}
            <Text size="sm">{blocked ?? t('documents.read.hint')}</Text>
          </>
        )}
        {!reading && counter}
        <ApiErrorAlert code={read.error ?? (use.error ? errorCode(use.error) : undefined)} />
      </Stack>
      <Divider variant="dashed" color="saffron" />
    </Box>
  )
}
