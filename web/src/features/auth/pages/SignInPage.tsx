import { Anchor, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { isEmail, isNotEmpty, useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { useFormError } from '~/shared/hooks/useFormError.ts'

export default function SignInPage() {
  const { t } = useTranslation()
  const formError = useFormError()
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: {
      email: isEmail('auth.errors.invalidEmail'),
      password: isNotEmpty('auth.errors.passwordRequired'),
    },
  })

  return (
    <AuthScreen
      title={t('auth.signIn')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Anchor component={Link} to="/register" inherit>
            {t('auth.signUp')}
          </Anchor>
        </>
      }
    >
      {/* TODO: submit to /api/auth/login */}
      <form onSubmit={form.onSubmit(() => undefined)} noValidate>
        <Stack gap="md">
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
            autoComplete="current-password"
            key={form.key('password')}
            {...form.getInputProps('password')}
            error={formError(form.errors.password)}
          />
          <Button type="submit" fullWidth>
            {t('auth.signIn')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
