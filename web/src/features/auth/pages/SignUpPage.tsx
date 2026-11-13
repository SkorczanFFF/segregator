import { Anchor, Button, Stack } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { emailRule } from '~/features/auth/email.ts'
import EmailInput from '~/features/auth/components/EmailInput.tsx'
import NewPasswordInput from '~/features/auth/components/NewPasswordInput.tsx'
import { newPasswordRules } from '~/features/auth/password.ts'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

type SignUpValues = { email: string; password: string }

export default function SignUpPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const formError = useFormError()
  // Controlled, so the password meter follows every keystroke.
  const form = useForm({
    initialValues: { email: '', password: '' },
    enhanceGetInputProps: validateFilledOnBlur(),
    validate: {
      email: emailRule,
      ...newPasswordRules,
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: SignUpValues) => {
    await api.post('/auth/register', values)
    navigate('/confirm', { state: { email: values.email } })
  })

  return (
    <AuthScreen
      title={t('auth.signUp')}
      step={{ current: 1, total: 2, label: t('auth.stepAccount') }}
      description={
        <>
          {t('auth.hasAccount')}{' '}
          <Anchor component={Link} to="/login" inherit>
            {t('auth.signIn')}
          </Anchor>
        </>
      }
    >
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="lg">
          {error && <StatusAlert status="error">{t(`errors.${error}`)}</StatusAlert>}
          <EmailInput
            label={t('common.email')}
            {...form.getInputProps('email')}
            error={formError(form.errors.email)}
          />
          <NewPasswordInput
            label={t('common.password')}
            email={form.values.email}
            {...form.getInputProps('password')}
            error={formError(form.errors.password)}
          />
          <Button type="submit" fullWidth loading={pending}>
            {t('auth.signUp')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
