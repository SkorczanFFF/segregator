import { Button, Group, Paper, Progress, Skeleton, Stack, Text, Title } from '@mantine/core'
import { IconLogout } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { STORAGE_LIMIT } from 'shared'
import { useSession, useSignOut } from '~/features/auth/session.ts'
import { useStorageUse } from '~/features/documents/useDocuments.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import AppControls from '~/shared/components/AppControls.tsx'
import Page from '~/shared/components/Page.tsx'
import { errorCode } from '~/shared/lib/api.ts'
import { formatFileSize } from '~/shared/lib/format.ts'

// The account, with signing out everywhere. On a phone it also takes the language, the color scheme and
// signing out of this device, which a wider screen keeps in the side menu.
export default function AccountPage() {
  const { t } = useTranslation()
  const { user } = useSession()
  const signOut = useSignOut('/auth/logout')
  const signOutEverywhere = useSignOut('/auth/logout-all')
  const storage = useStorageUse()

  return (
    <Page title={t('account.title')} width={480}>
      <Stack gap="xl">
        <Text>{t('account.signedInAs', { email: user?.email ?? '' })}</Text>
        <Stack gap={6}>
          <Group justify="space-between">
            <Text fw={600}>{t('account.storage')}</Text>
            {storage.data && (
              <Text size="sm" ff="monospace">
                {t('account.storageUsed', {
                  used: formatFileSize(storage.data.used),
                  limit: formatFileSize(STORAGE_LIMIT),
                })}
              </Text>
            )}
          </Group>
          {storage.data ? (
            <Progress
              value={(storage.data.used / STORAGE_LIMIT) * 100}
              color="saffron"
              aria-label={t('account.storage')}
            />
          ) : (
            !storage.error && <Skeleton h={8} />
          )}
          <ApiErrorAlert code={storage.error ? errorCode(storage.error) : undefined} />
          <Text size="sm" c="dimmed">
            {t('account.storageHint')}
          </Text>
        </Stack>
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
