import { Alert, Button, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { useSession } from '~/features/auth/session.ts'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api } from '~/shared/lib/api.ts'

export default function AccountPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, setUser } = useSession()
  const { submit: signOut, pending, error } = useApiSubmit(async () => {
    await api.post('/auth/logout')
    // Both updates land in one render, so the session gate lets the entry page through.
    setUser(null)
    navigate('/', { replace: true })
  })

  return (
    <AuthScreen title={t('account.title')} google={false}>
      <Stack gap="md">
        <Text>{t('account.signedInAs', { email: user?.email ?? '' })}</Text>
        {error && <Alert color="red">{t(`errors.${error}`)}</Alert>}
        <Button variant="light" fullWidth loading={pending} onClick={() => void signOut(undefined)}>
          {t('account.signOut')}
        </Button>
      </Stack>
    </AuthScreen>
  )
}
