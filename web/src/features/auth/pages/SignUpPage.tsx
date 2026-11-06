import { Anchor, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { hasLength, isEmail, useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { useFormError } from '~/shared/hooks/useFormError.ts'

const PASSWORD_MIN_LENGTH = 12

export default function SignUpPage() {
  const { t } = useTranslation()
  const formError = useFormError({ min: PASSWORD_MIN_LENGTH })
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: {
      email: isEmail('auth.errors.invalidEmail'),
      password: hasLength(
        { min: PASSWORD_MIN_LENGTH },
        'auth.errors.passwordTooShort',
      ),
    },
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
      {/* TODO: submit to /api/auth/register */}
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
            description={t('auth.passwordHint', { min: PASSWORD_MIN_LENGTH })}
            autoComplete="new-password"
            key={form.key('password')}
            {...form.getInputProps('password')}
            error={formError(form.errors.password)}
          />
          <Button type="submit" fullWidth>
            {t('auth.signUp')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
