import { Button, Divider, Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import AuthLayout from '~/features/auth/components/AuthLayout.tsx'
import GoogleButton from '~/features/auth/components/GoogleButton.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'

export default function EntryPage() {
  const { t } = useTranslation()
  // Set by the account page after it deleted the account.
  const accountDeleted = (useLocation().state as { accountDeleted?: boolean } | null)?.accountDeleted

  return (
    <AuthLayout>
      <Stack gap="xl">
        {accountDeleted && <StatusAlert status="success">{t('entry.accountDeleted')}</StatusAlert>}
        <Stack gap="xs">
          <Title>{t('entry.title')}</Title>
          <Text c="dimmed">{t('entry.lead')}</Text>
        </Stack>
        <Stack gap="sm">
          <GoogleButton />
          <Divider label={t('auth.orEmail')} labelPosition="center" />
          <Button component={Link} to="/register" fullWidth>
            {t('entry.signUpEmail')}
          </Button>
          <Button component={Link} to="/login" variant="light" fullWidth>
            {t('auth.signIn')}
          </Button>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
