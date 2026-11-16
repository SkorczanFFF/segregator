import { Button, Divider, Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import AuthLayout from '~/features/auth/components/AuthLayout.tsx'
import GoogleButton from '~/shared/components/GoogleButton.tsx'

export default function EntryPage() {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <Stack gap="xl">
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
