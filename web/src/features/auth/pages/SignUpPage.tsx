import { Alert, Anchor, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { isEmail, useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { newPasswordRules, PASSWORD_MIN_LENGTH } from '~/features/auth/password.ts'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'

type SignUpValues = { email: string; password: string }

export default function SignUpPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const formError = useFormError({ min: PASSWORD_MIN_LENGTH })
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: {
      email: isEmail('auth.errors.invalidEmail'),
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
          <PasswordInput
            label={t('common.password')}
            description={t('auth.passwordHint', { min: PASSWORD_MIN_LENGTH })}
            autoComplete="new-password"
            key={form.key('password')}
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
