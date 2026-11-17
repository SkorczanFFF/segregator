import { Button, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useSession, useSignOut } from '~/features/auth/session.ts'
import Page from '~/shared/components/Page.tsx'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'

// Signing out of this device sits in the header, or the side menu on a phone; here only signing out everywhere.
export default function AccountPage() {
  const { t } = useTranslation()
  const { user } = useSession()
  const signOutEverywhere = useSignOut('/auth/logout-all')

  return (
    <Page title={t('account.title')} width={480}>
      <Stack gap="md">
        <Text>{t('account.signedInAs', { email: user?.email ?? '' })}</Text>
        {signOutEverywhere.error && (
          <ApiErrorAlert code={signOutEverywhere.error} />
        )}
        <Stack gap={6}>
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
