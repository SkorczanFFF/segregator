import { Alert, Anchor, Button, Stack, Text, TextInput } from '@mantine/core'
import { isEmail, matches, useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'

type ConfirmState = { email?: string; resent?: boolean } | null
type ConfirmValues = { email: string; code: string }

export default function ConfirmPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useLocation().state as ConfirmState
  const formError = useFormError()
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: state?.email ?? '', code: '' },
    validate: {
      email: isEmail('auth.errors.invalidEmail'),
      code: matches(/^\d{6}$/, 'auth.errors.invalidCode'),
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: ConfirmValues) => {
    await api.post('/auth/confirm', values)
    navigate('/login', { state: { email: values.email, confirmed: true } })
  })

  return (
    <AuthScreen
      title={t('auth.confirmTitle')}
      google={false}
      footer={
        <>
          {t('auth.hasAccount')}{' '}
          <Anchor component={Link} to="/login" inherit>
            {t('auth.signIn')}
          </Anchor>
        </>
      }
    >
      <form onSubmit={form.onSubmit(submit)} noValidate>
        <Stack gap="md">
          <Text>{t(state?.resent ? 'auth.codeResent' : 'auth.confirmLead')}</Text>
          {error && <Alert color="red">{t(`errors.${error}`)}</Alert>}
          <TextInput
            label={t('common.email')}
            type="email"
            inputMode="email"
            autoComplete="username"
            key={form.key('email')}
            {...form.getInputProps('email')}
            error={formError(form.errors.email)}
          />
          <TextInput
            label={t('common.code')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            key={form.key('code')}
            {...form.getInputProps('code')}
            error={formError(form.errors.code)}
          />
          <Button type="submit" fullWidth loading={pending}>
            {t('auth.confirm')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
