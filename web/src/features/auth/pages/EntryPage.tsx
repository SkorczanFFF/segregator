import { Button, Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import AuthLayout from '~/features/auth/components/AuthLayout.tsx'
import { APP_NAME } from '~/shared/lib/app.ts'

export default function EntryPage() {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <Stack gap="xl">
        <Stack gap="sm">
          <Title c="brand" fz={46}>
            {APP_NAME}
          </Title>
          <Text size="lg">{t('entry.lead')}</Text>
        </Stack>
        <Stack gap="sm">
          <Button component={Link} to="/login" fullWidth>
            {t('auth.signIn')}
          </Button>
          <Button component={Link} to="/register" variant="light" fullWidth>
            {t('auth.signUp')}
          </Button>
          <Button variant="subtle" fullWidth>
            {t('entry.demo')}
          </Button>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
