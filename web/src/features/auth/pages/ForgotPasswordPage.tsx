import { Anchor, Button, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { emailRule } from '~/features/auth/email.ts'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

type ForgotValues = { email: string }

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
  const { submit, pending, error } = useApiSubmit(async (values: ForgotValues) => {
    await api.post('/auth/forgot-password', values)
    navigate('/reset-password', { state: { email: values.email } })
  })

  return (
    <AuthScreen
      title={t('auth.forgotTitle')}
      description={t('auth.forgotLead')}
      google={false}
      footer={
        <>
          {t('auth.rememberPassword')}{' '}
          <Anchor component={Link} to="/login" inherit>
            {t('auth.signIn')}
          </Anchor>
        </>
      }
    >
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="lg">
          {error && <StatusAlert status="error">{t(`errors.${error}`)}</StatusAlert>}
          <TextInput
            label={t('common.email')}
            type="email"
            inputMode="email"
            autoComplete="username"
            key={form.key('email')}
            {...form.getInputProps('email')}
            error={formError(form.errors.email)}
          />
          <Button type="submit" fullWidth loading={pending}>
            {t('auth.sendCode')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
