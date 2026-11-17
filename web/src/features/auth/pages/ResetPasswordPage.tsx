import { Button, Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import type { ResetInput } from 'shared'
import { codeRule } from '~/features/auth/code.ts'
import AuthPrompt from '~/features/auth/components/AuthPrompt.tsx'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import CodeInput from '~/features/auth/components/CodeInput.tsx'
import EmailField from '~/features/auth/components/EmailField.tsx'
import { emailRule } from '~/features/auth/email.ts'
import NewPasswordInput from '~/features/auth/components/NewPasswordInput.tsx'
import { newPasswordRules } from '~/features/auth/password.ts'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

type ResetState = { email?: string } | null

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
      code: codeRule,
      ...newPasswordRules,
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: ResetInput) => {
    await api.post('/auth/reset-password', values)
    navigate('/login', { state: { email: values.email, passwordReset: true } })
  })

  return (
    <AuthScreen
      title={t('auth.resetTitle')}
      description={t('auth.resetLead')}
      google={false}
      footer={<AuthPrompt text={t('auth.noCode')} link={t('auth.sendAgain')} to="/forgot-password" />}
    >
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="lg">
          {error && (
            <StatusAlert status="error">
              {t(error === 'code_expired' ? 'auth.resetCodeExpired' : `errors.${error}`)}
            </StatusAlert>
          )}
          <EmailField {...form.getInputProps('email')} error={formError(form.errors.email)} />
          <CodeInput {...form.getInputProps('code')} error={formError(form.errors.code)} />
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
