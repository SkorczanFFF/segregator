import { Group, PasswordInput, Progress, Stack, Text, type PasswordInputProps } from '@mantine/core'
import { IconCheck, IconCircle, IconX } from '@tabler/icons-react'
import { useId, type FocusEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  PASSWORD_MIN_LENGTH,
  passwordChecks,
  passwordStrength,
  type PasswordCheck,
} from '~/features/auth/password.ts'
import CapsLockNote from '~/shared/components/CapsLockNote.tsx'
import { useCapsLock } from '~/shared/hooks/useCapsLock.ts'

const STRENGTH = ['empty', 'short', 'short', 'good', 'strong'] as const
const CHECKS: PasswordCheck[] = ['length', 'edges', 'email']

type NewPasswordInputProps = Omit<PasswordInputProps, 'value'> & { value?: string; email: string }

// A new password with a live strength meter and requirements.
// Requirements get a tick as they are met; unmet ones turn red only once the field has an error.
export default function NewPasswordInput({ value = '', email, error, onBlur, ...props }: NewPasswordInputProps) {
  const { t } = useTranslation()
  const { capsLock, onKeyUp, reset } = useCapsLock()
  const listId = useId()
  const checks = passwordChecks(value, email)
  const strength = passwordStrength(value.length)

  return (
    <Stack gap={6}>
      <PasswordInput
        autoComplete="new-password"
        value={value}
        error={Boolean(error)}
        aria-describedby={listId}
        onKeyUp={onKeyUp}
        onBlur={(event: FocusEvent<HTMLInputElement>) => {
          reset()
          onBlur?.(event)
        }}
        {...props}
      />
      {capsLock && <CapsLockNote />}
      <Group grow gap={4} aria-hidden>
        {[1, 2, 3, 4].map((level) => (
          <Progress key={level} size={4} value={strength >= level ? 100 : 0} color={strength >= 3 ? 'brand' : 'brand.3'} />
        ))}
      </Group>
      <Group justify="space-between">
        <Text size="xs" c="dimmed" aria-live="polite">
          {t(`auth.strength.${STRENGTH[strength]}`)}
        </Text>
        <Text size="xs" c="dimmed" ff="monospace">
          {value.length} / {PASSWORD_MIN_LENGTH}
        </Text>
      </Group>
      <Stack component="ul" id={listId} gap={4} m={0} p={0} style={{ listStyle: 'none' }}>
        {CHECKS.map((check) => {
          const met = checks[check]
          const failed = !met && Boolean(error) && (check === 'length' || value.length > 0)
          const Icon = met ? IconCheck : failed ? IconX : IconCircle
          const color = met ? 'var(--mantine-color-brand-text)' : failed ? 'var(--mantine-color-error)' : 'dimmed'
          return (
            <Group component="li" key={check} gap={8} wrap="nowrap">
              <Text span c={color} lh={0}>
                <Icon size={16} aria-hidden />
              </Text>
              <Text size="sm" c={met ? undefined : color}>
                {t(`auth.requirements.${check}`, { min: PASSWORD_MIN_LENGTH })}
              </Text>
            </Group>
          )
        })}
      </Stack>
      <Text size="xs" c="dimmed">
        {t('auth.passwordTip')}
      </Text>
    </Stack>
  )
}
