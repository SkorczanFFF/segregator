import { Anchor, Button, Stack, Text } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useInterval } from '@mantine/hooks'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import type { ConfirmInput } from 'shared'
import { codeRule } from '~/features/auth/code.ts'
import AuthPrompt from '~/features/auth/components/AuthPrompt.tsx'
import AuthScreen from '~/features/auth/components/AuthScreen.tsx'
import CodeInput from '~/features/auth/components/CodeInput.tsx'
import EmailField from '~/features/auth/components/EmailField.tsx'
import { emailRule } from '~/features/auth/email.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useFormError } from '~/shared/hooks/useFormError.ts'
import { api } from '~/shared/lib/api.ts'
import { focusFirstError, validateFilledOnBlur } from '~/shared/lib/form.ts'

// Gives the first email time to arrive before another code is offered.
const RESEND_DELAY = 45

type ConfirmState = { email?: string; resent?: boolean } | null

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
      code: codeRule,
    },
  })
  const { submit, pending, error } = useApiSubmit(async (values: ConfirmInput) => {
    await api.post('/auth/confirm', values)
    navigate('/login', { state: { email: values.email, confirmed: true } })
  })

  const [notice, setNotice] = useState<'notConfirmed' | 'sent' | null>(state?.resent ? 'notConfirmed' : null)
  const [seconds, setSeconds] = useState(RESEND_DELAY)
  useInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000, { autoInvoke: true })
  const resend = useApiSubmit(async () => {
    if (form.validateField('email').hasError) return
    setNotice(null)
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
          <AuthPrompt text={t('auth.codeSentTo', { email: knownEmail })} link={t('auth.changeEmail')} to="/register" />
        ) : (
          t('auth.confirmLead')
        )
      }
    >
      <form onSubmit={form.onSubmit(submit, focusFirstError(form))} noValidate>
        <Stack gap="lg">
          {notice && !apiError && (
            <StatusAlert status={notice === 'sent' ? 'success' : 'warning'}>
              {t(notice === 'sent' ? 'auth.codeSent' : 'auth.codeResent')}
            </StatusAlert>
          )}
          <ApiErrorAlert code={apiError} />
          {!knownEmail && (
            <EmailField key={form.key('email')} {...form.getInputProps('email')} error={formError(form.errors.email)} />
          )}
          <CodeInput
            autoFocus={Boolean(knownEmail)}
            key={form.key('code')}
            {...form.getInputProps('code')}
            error={formError(form.errors.code)}
            onComplete={completeCode}
          />
          <Text size="sm" c="dimmed">
            {t('auth.notArrived')}{' '}
            {seconds > 0 ? (
              t('auth.resendIn', { seconds })
            ) : (
              <Trans
                i18nKey="auth.resend"
                components={{
                  link: (
                    <Anchor
                      component="button"
                      type="button"
                      fz="sm"
                      fw={600}
                      onClick={() => void resend.submit(undefined)}
                    />
                  ),
                }}
              />
            )}{' '}
            {t('auth.checkSpam')}
          </Text>
          <Button type="submit" fullWidth loading={pending || resend.pending}>
            {t('auth.confirm')}
          </Button>
        </Stack>
      </form>
    </AuthScreen>
  )
}
