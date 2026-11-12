import { Alert, Anchor, Button, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { matches, useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { emailRule } from '~/features/auth/email.ts'
import { newPasswordRules, PASSWORD_MIN_LENGTH } from '~/features/auth/password.ts'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'

type ResetState = { email?: string } | null
type ResetValues = { email: string; code: string; password: string }

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useLocation().state as ResetState
  const formError = useFormError({ min: PASSWORD_MIN_LENGTH })
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: state?.email ?? '', code: '', password: '' },
    validate: {
      email: emailRule,
      code: matches(/^\d{6}$/, 'auth.errors.invalidCode'),
      ...newPasswordRules,
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: ResetValues) => {
    await api.post('/auth/reset-password', values)
    navigate('/login', { state: { email: values.email, passwordReset: true } })
  })

  return (
    <AuthScreen
      title={t('auth.resetTitle')}
      google={false}
      footer={
        <>
          {t('auth.noCode')}{' '}
          <Anchor component={Link} to="/forgot-password" inherit>
            {t('auth.sendAgain')}
          </Anchor>
        </>
      }
    >
      <form onSubmit={form.onSubmit(submit)} noValidate>
        <Stack gap="md">
          <Text>{t('auth.resetLead')}</Text>
          {error && (
            <Alert color="red">
              {t(error === 'code_expired' ? 'auth.resetCodeExpired' : `errors.${error}`)}
            </Alert>
          )}
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
          <PasswordInput
            label={t('auth.newPassword')}
            description={t('auth.passwordHint', { min: PASSWORD_MIN_LENGTH })}
            autoComplete="new-password"
            key={form.key('password')}
            {...form.getInputProps('password')}
            error={formError(form.errors.password)}
          />
          <Button type="submit" fullWidth loading={pending}>
            {t('auth.setPassword')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
