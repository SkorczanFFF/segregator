import { Button, Group, Paper, Progress, Skeleton, Stack, Text, Title } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { STORAGE_LIMIT } from 'shared'
import { useSession, useSignOut } from '~/features/auth/session.ts'
import { useReadUse, useStorageUse } from '~/features/documents/useDocuments.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import AppControls from '~/shared/components/AppControls.tsx'
import Page from '~/shared/components/Page.tsx'
import { errorCode } from '~/shared/lib/api.ts'
import { formatFileSize } from '~/shared/lib/format.ts'

type MeterProps = {
  label: string
  // The figure beside the label and the bar's fill, once loaded.
  value?: string
  percent?: number
  error: Error | null
  hint: ReactNode
}

// A use against its limit: the figure, a bar and what counts towards it.
function Meter({ label, value, percent, error, hint }: MeterProps) {
  return (
    <Stack gap={6}>
      <Group justify="space-between">
        <Text fw={600}>{label}</Text>
        {value && (
          <Text size="sm" ff="monospace">
            {value}
          </Text>
        )}
      </Group>
      {percent !== undefined ? (
        <Progress value={percent} color="saffron" aria-label={label} />
      ) : (
        !error && <Skeleton h={8} />
      )}
      <ApiErrorAlert code={error ? errorCode(error) : undefined} />
      <Text size="sm" c="dimmed">
        {hint}
      </Text>
    </Stack>
  )
}

// The account: the storage and the readings with AI it has left, and signing out everywhere. On a phone it
// also takes the language, the color scheme and signing out of this device, which a wider screen keeps in the
// side menu.
export default function AccountPage() {
  const { t } = useTranslation()
  const { user } = useSession()
  const signOut = useSignOut('/auth/logout')
  const signOutEverywhere = useSignOut('/auth/logout-all')
  const storage = useStorageUse()
  const reads = useReadUse()

  return (
    <Page title={t('account.title')} width={480}>
      <Stack gap="xl">
        <Text>{t('account.signedInAs', { email: user?.email ?? '' })}</Text>
        <Meter
          label={t('account.storage')}
          value={
            storage.data &&
            t('account.storageUsed', { used: formatFileSize(storage.data.used), limit: formatFileSize(STORAGE_LIMIT) })
          }
          percent={storage.data && (storage.data.used / STORAGE_LIMIT) * 100}
          error={storage.error}
          hint={t('account.storageHint')}
        />
        <Meter
          label={t('account.reads')}
          value={reads.data && t('account.readsLeft', reads.data)}
          percent={reads.data && (reads.data.limit ? (reads.data.left / reads.data.limit) * 100 : 0)}
          error={reads.error}
          hint={reads.data && !reads.data.open ? t('documents.read.closed') : t('account.readsHint')}
        />
        <Stack gap="sm" hiddenFrom="sm">
          <Title order={2} size="h4">
            {t('account.settings')}
          </Title>
          <Paper p="md">
            <AppControls withLabels />
          </Paper>
        </Stack>
        <Stack gap="sm">
          <Title order={2} size="h4">
            {t('account.session')}
          </Title>
          <ApiErrorAlert code={signOut.error ?? signOutEverywhere.error} />
          <Button
            variant="default"
            fullWidth
            hiddenFrom="sm"
            leftSection={<IconLogout size={18} aria-hidden />}
            loading={signOut.pending}
            onClick={() => void signOut.submit(undefined)}
          >
            {t('app.signOut')}
          </Button>
          <Button
            variant="light"
            color="red"
            fullWidth
            loading={signOutEverywhere.pending}
            onClick={() => void signOutEverywhere.submit(undefined)}
          >
            {t('account.signOutEverywhere')}
          </Button>
          <Text size="sm" c="dimmed">
            {t('account.signOutEverywhereHint')}
          </Text>
        </Stack>
      </Stack>
    </Page>
  )
}
