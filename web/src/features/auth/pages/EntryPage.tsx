import { Button, Divider, Stack, Text, Title } from '@mantine/core'
import { IconEye } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import type { User } from 'shared'
import AuthLayout from '~/features/auth/components/AuthLayout.tsx'
import GoogleButton from '~/features/auth/components/GoogleButton.tsx'
import { useSession, type EntryState } from '~/features/auth/session.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api } from '~/shared/lib/api.ts'

export default function EntryPage() {
  const { t } = useTranslation()
  const accountDeleted = (useLocation().state as EntryState | null)?.accountDeleted
  const { setUser } = useSession()
  const demo = useApiSubmit(async () => setUser(await api.post<User>('/auth/demo')))

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
        <Stack gap={6}>
          <ApiErrorAlert code={demo.error} />
          <Button
            variant="default"
            leftSection={<IconEye size={18} color="var(--mantine-color-saffron-filled)" aria-hidden />}
            fullWidth
            loading={demo.pending}
            onClick={() => void demo.submit(undefined)}
          >
            {t('entry.demo')}
          </Button>
          <Text size="sm" c="dimmed" ta="center">
            {t('entry.demoHint')}
          </Text>
        </Stack>
      </Stack>
    </AuthLayout>
  )
}
