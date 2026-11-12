import { Alert, Anchor, Button, Input, PinInput, Stack, TextInput } from '@mantine/core'
import { matches, useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { emailRule } from '~/features/auth/email.ts'
import NewPasswordInput from '~/features/auth/components/NewPasswordInput.tsx'
import { newPasswordRules } from '~/features/auth/password.ts'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

type ResetState = { email?: string } | null
type ResetValues = { email: string; code: string; password: string }

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useLocation().state as ResetState
  const formError = useFormError()
  // Controlled, so the password meter follows every keystroke.
  const form = useForm({
    initialValues: { email: state?.email ?? '', code: '', password: '' },
    enhanceGetInputProps: validateFilledOnBlur('email', 'password'),
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
      description={t('auth.resetLead')}
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
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="lg">
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
            {...form.getInputProps('email')}
            error={formError(form.errors.email)}
          />
          <Input.Wrapper label={t('common.code')} error={formError(form.errors.code)}>
            <PinInput
              length={6}
              type="number"
              size="lg"
              gap="sm"
              mt={6}
              oneTimeCode
              ariaLabel={t('common.code')}
              {...form.getInputProps('code')}
              error={Boolean(form.errors.code)}
            />
          </Input.Wrapper>
          <NewPasswordInput
            label={t('auth.newPassword')}
            email={form.values.email}
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
