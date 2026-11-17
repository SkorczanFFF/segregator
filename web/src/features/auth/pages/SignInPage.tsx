import { Anchor, Button, Stack } from '@mantine/core'
import { isNotEmpty, useForm } from '@mantine/form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import type { LoginInput, User } from 'shared'
import AuthPrompt from '~/features/auth/components/AuthPrompt.tsx'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import EmailField from '~/features/auth/components/EmailField.tsx'
import PasswordField from '~/features/auth/components/PasswordField.tsx'
import { emailRule } from '~/features/auth/email.ts'
import { useSession } from '~/features/auth/session.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { ApiError, api, isErrorCode } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

type SignInState = { email?: string; confirmed?: boolean; passwordReset?: boolean } | null

export default function SignInPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useLocation().state as SignInState
  // The API adds a code to the address when a Google sign-in comes back without a session.
  const googleError = useSearchParams()[0].get('error')
  const { setUser } = useSession()
  const formError = useFormError()
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: state?.email ?? '', password: '' },
    enhanceGetInputProps: validateFilledOnBlur(),
    validate: {
      email: emailRule,
      password: isNotEmpty('auth.errors.passwordRequired'),
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: LoginInput) => {
    try {
      // The session gate then moves the user on to the documents list.
      setUser(await api.post<User>('/auth/login', values))
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'not_confirmed')) throw err
      navigate('/confirm', { state: { email: values.email, resent: true } })
    }
  })

  return (
    <AuthScreen
      title={t('auth.signIn')}
      description={<AuthPrompt text={t('auth.noAccount')} link={t('auth.signUp')} to="/register" />}
    >
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="lg">
          {state?.confirmed && !error && <StatusAlert status="success">{t('auth.confirmed')}</StatusAlert>}
          {state?.passwordReset && !error && <StatusAlert status="success">{t('auth.passwordChanged')}</StatusAlert>}
          {!error && <ApiErrorAlert code={isErrorCode(googleError) ? googleError : undefined} />}
          {error && (
            <StatusAlert status="error">
              {t(`errors.${error}`)}{' '}
              {error === 'invalid_credentials' && (
                <Anchor component={Link} to="/forgot-password" inherit fw={600} c="inherit">
                  {t('auth.forgotPassword')}
                </Anchor>
              )}
            </StatusAlert>
          )}
          <EmailField key={form.key('email')} {...form.getInputProps('email')} error={formError(form.errors.email)} />
          <Stack gap={6}>
            <PasswordField
              label={t('common.password')}
              autoComplete="current-password"
              key={form.key('password')}
              {...form.getInputProps('password')}
              error={formError(form.errors.password)}
            />
            <Anchor component={Link} to="/forgot-password" size="sm" ta="right">
              {t('auth.forgotPassword')}
            </Anchor>
          </Stack>
          <Button type="submit" fullWidth loading={pending}>
            {t('auth.signIn')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
