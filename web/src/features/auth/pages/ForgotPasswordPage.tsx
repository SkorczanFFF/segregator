import { Button, Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { ForgotInput } from 'shared'
import AuthPrompt from '~/features/auth/components/AuthPrompt.tsx'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import EmailField from '~/features/auth/components/EmailField.tsx'
import { emailRule } from '~/features/auth/email.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const formError = useFormError()
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '' },
    enhanceGetInputProps: validateFilledOnBlur(),
    validate: { email: emailRule },
  })
  const { submit, pending, error } = useApiSubmit(async (values: ForgotInput) => {
    await api.post('/auth/forgot-password', values)
    navigate('/reset-password', { state: { email: values.email } })
  })

  return (
    <AuthScreen
      title={t('auth.forgotTitle')}
      description={t('auth.forgotLead')}
      google={false}
      footer={<AuthPrompt text={t('auth.rememberPassword')} link={t('auth.signIn')} to="/login" />}
    >
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="lg">
          <ApiErrorAlert code={error} />
          <EmailField key={form.key('email')} {...form.getInputProps('email')} error={formError(form.errors.email)} />
          <Button type="submit" fullWidth loading={pending}>
            {t('auth.sendCode')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
