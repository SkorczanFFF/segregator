import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core'
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
          <Button component={Link} to="/register" fullWidth>
            {t('entry.signUpEmail')}
          </Button>
          <Button component={Link} to="/login" variant="light" fullWidth>
            {t('auth.signIn')}
          </Button>
        </Stack>
        <Paper p="md" shadow="none" style={{ borderStyle: 'dashed' }}>
          <Group justify="space-between" wrap="nowrap" gap="md">
            <Stack gap={2}>
              <Text fw={600}>{t('entry.demoTitle')}</Text>
              <Text size="sm" c="dimmed">
                {t('entry.demoText')}
              </Text>
            </Stack>
            <Button variant="subtle" size="sm" style={{ flex: 'none' }}>
              {t('entry.demo')}
            </Button>
          </Group>
        </Paper>
      </Stack>
    </AuthLayout>
  )
}
