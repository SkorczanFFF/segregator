import { Button, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useSession } from '~/features/auth/session.ts'
import Page from '~/shared/components/Page.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api } from '~/shared/lib/api.ts'

export default function AccountPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, setUser } = useSession()
  const signOutVia = (path: string) => async () => {
    await api.post(path)
    // Both updates land in one render, so the session gate lets the entry page through.
    setUser(null)
    navigate('/', { replace: true })
  }
  const signOut = useApiSubmit(signOutVia('/auth/logout'))
  const signOutEverywhere = useApiSubmit(signOutVia('/auth/logout-all'))
  const error = signOut.error ?? signOutEverywhere.error

  return (
    <Page title={t('account.title')} width={480}>
      <Stack gap="md">
        <Text>{t('account.signedInAs', { email: user?.email ?? '' })}</Text>
        {error && <StatusAlert status="error">{t(`errors.${error}`)}</StatusAlert>}
        <Button variant="light" fullWidth loading={signOut.pending} onClick={() => void signOut.submit(undefined)}>
          {t('account.signOut')}
        </Button>
        <Stack gap={6}>
          <Button
            variant="default"
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
