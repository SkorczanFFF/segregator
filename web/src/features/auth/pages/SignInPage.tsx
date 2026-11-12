import { Alert, Anchor, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { isEmail, isNotEmpty, useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { useSession, type User } from '~/features/auth/session.ts'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { ApiError, api } from '~/shared/lib/api.ts'

type SignInState = { email?: string; confirmed?: boolean; passwordReset?: boolean } | null
type SignInValues = { email: string; password: string }

export default function SignInPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useLocation().state as SignInState
  const { setUser } = useSession()
  const formError = useFormError()
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: state?.email ?? '', password: '' },
    validate: {
      email: isEmail('auth.errors.invalidEmail'),
      password: isNotEmpty('auth.errors.passwordRequired'),
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: SignInValues) => {
    try {
      // The session gate then moves the user on to the account page.
      setUser(await api.post<User>('/auth/login', values))
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'not_confirmed')) throw err
      navigate('/confirm', { state: { email: values.email, resent: true } })
    }
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
      <form onSubmit={form.onSubmit(submit)} noValidate>
        <Stack gap="md">
          {state?.confirmed && !error && <Alert>{t('auth.confirmed')}</Alert>}
          {state?.passwordReset && !error && <Alert>{t('auth.passwordChanged')}</Alert>}
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
            autoComplete="current-password"
            key={form.key('password')}
            {...form.getInputProps('password')}
            error={formError(form.errors.password)}
          />
          <Anchor component={Link} to="/forgot-password" size="sm" ta="right">
            {t('auth.forgotPassword')}
          </Anchor>
          <Button type="submit" fullWidth loading={pending}>
            {t('auth.signIn')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
