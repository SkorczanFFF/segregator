import { Alert, Anchor, Button, Input, PinInput, Stack, Text, TextInput } from '@mantine/core'
import { matches, useForm } from '@mantine/form'
import { useInterval } from '@mantine/hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import { emailRule } from '~/features/auth/email.ts'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

// Gives the first email time to arrive before another code is offered.
const RESEND_DELAY = 45

type ConfirmState = { email?: string; resent?: boolean } | null
type ConfirmValues = { email: string; code: string }

export default function ConfirmPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const state = useLocation().state as ConfirmState
  const knownEmail = state?.email
  const formError = useFormError()
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: knownEmail ?? '', code: '' },
    enhanceGetInputProps: validateFilledOnBlur('email'),
    validate: {
      email: emailRule,
      code: matches(/^\d{6}$/, 'auth.errors.invalidCode'),
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: ConfirmValues) => {
    await api.post('/auth/confirm', values)
    navigate('/login', { state: { email: values.email, confirmed: true } })
  })

  const [notice, setNotice] = useState<'notConfirmed' | 'sent' | null>(state?.resent ? 'notConfirmed' : null)
  const [seconds, setSeconds] = useState(RESEND_DELAY)
  useInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000, { autoInvoke: true })
  const resend = useApiSubmit(async () => {
    await api.post('/auth/resend-code', { email: form.getValues().email })
    setSeconds(RESEND_DELAY)
    setNotice('sent')
  })

  const apiError = error ?? resend.error

  // The last digit sends the form, so a code pasted or filled in by the phone needs no extra tap.
  const completeCode = (code: string) => {
    if (!form.validateField('email').hasError) void submit({ email: form.getValues().email, code })
  }

  return (
    <AuthScreen
      title={t('auth.confirmTitle')}
      step={{ current: 2, total: 2, label: t('auth.stepConfirm') }}
      google={false}
      description={
        knownEmail ? (
          <>
            {t('auth.codeSentTo', { email: knownEmail })}{' '}
            <Anchor component={Link} to="/register" inherit>
              {t('auth.changeEmail')}
            </Anchor>
          </>
        ) : (
          t('auth.confirmLead')
        )
      }
    >
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="lg">
          {notice && !error && (
            <Alert>{t(notice === 'sent' ? 'auth.codeSent' : 'auth.codeResent')}</Alert>
          )}
          {apiError && <Alert color="red">{t(`errors.${apiError}`)}</Alert>}
          {!knownEmail && (
            <TextInput
              label={t('common.email')}
              type="email"
              inputMode="email"
              autoComplete="username"
              key={form.key('email')}
              {...form.getInputProps('email')}
              error={formError(form.errors.email)}
            />
          )}
          <Input.Wrapper label={t('common.code')} error={formError(form.errors.code)}>
            <PinInput
              length={6}
              type="number"
              size="lg"
              gap="sm"
              mt={6}
              oneTimeCode
              autoFocus={Boolean(knownEmail)}
              ariaLabel={t('common.code')}
              key={form.key('code')}
              {...form.getInputProps('code')}
              error={Boolean(form.errors.code)}
              onComplete={completeCode}
            />
          </Input.Wrapper>
          <Text size="sm" c="dimmed">
            {t('auth.notArrived')}{' '}
            {seconds > 0 ? (
              t('auth.resendIn', { seconds })
            ) : (
              <Anchor component="button" type="button" fz="sm" fw={600} onClick={() => void resend.submit(undefined)}>
                {t('auth.resend')}
              </Anchor>
            )}
            . {t('auth.checkSpam')}
          </Text>
          <Button type="submit" fullWidth loading={pending || resend.pending}>
            {t('auth.confirm')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
