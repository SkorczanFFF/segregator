import { Anchor, Button, PasswordInput, Stack, TextInput } from '@mantine/core'
import { isNotEmpty, useForm } from '@mantine/form'
import type { FocusEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { emailRule } from '~/features/auth/email.ts'
import { useSession, type User } from '~/features/auth/session.ts'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import CapsLockNote from '~/shared/components/CapsLockNote.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useCapsLock } from '~/shared/hooks/useCapsLock.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { ApiError, api } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

type SignInState = { email?: string; confirmed?: boolean; passwordReset?: boolean } | null
type SignInValues = { email: string; password: string }

export default function SignInPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useLocation().state as SignInState
  const { setUser } = useSession()
  const formError = useFormError()
  const { capsLock, onKeyUp, reset } = useCapsLock()
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: state?.email ?? '', password: '' },
    enhanceGetInputProps: validateFilledOnBlur(),
    validate: {
      email: emailRule,
      password: isNotEmpty('auth.errors.passwordRequired'),
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: SignInValues) => {
    try {
      // The session gate then moves the user on to the documents list.
      setUser(await api.post<User>('/auth/login', values))
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'not_confirmed')) throw err
      navigate('/confirm', { state: { email: values.email, resent: true } })
    }
  })
  const passwordProps = form.getInputProps('password')

  return (
    <AuthScreen
      title={t('auth.signIn')}
      description={
        <>
          {t('auth.noAccount')}{' '}
          <Anchor component={Link} to="/register" inherit>
            {t('auth.signUp')}
          </Anchor>
        </>
      }
    >
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="lg">
          {state?.confirmed && !error && <StatusAlert status="success">{t('auth.confirmed')}</StatusAlert>}
          {state?.passwordReset && !error && <StatusAlert status="success">{t('auth.passwordChanged')}</StatusAlert>}
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
          <TextInput
            label={t('common.email')}
            type="email"
            inputMode="email"
            autoComplete="username"
            key={form.key('email')}
            {...form.getInputProps('email')}
            error={formError(form.errors.email)}
          />
          <Stack gap={6}>
            <PasswordInput
              label={t('common.password')}
              autoComplete="current-password"
              key={form.key('password')}
              {...passwordProps}
              onKeyUp={onKeyUp}
              onBlur={(event: FocusEvent<HTMLInputElement>) => {
                reset()
                passwordProps.onBlur?.(event)
              }}
              error={formError(form.errors.password)}
            />
            {capsLock && <CapsLockNote />}
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
