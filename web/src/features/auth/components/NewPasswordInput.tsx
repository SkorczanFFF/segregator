import { Group, List, Progress, Stack, Text, VisuallyHidden, type PasswordInputProps } from '@mantine/core'
import { IconCheck, IconCircle, IconX } from '@tabler/icons-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { PASSWORD_MIN_LENGTH } from 'shared'
import PasswordField from '~/features/auth/components/PasswordField.tsx'
import { passwordChecks, passwordStrength } from '~/features/auth/password.ts'

const STRENGTH = ['empty', 'short', 'short', 'good', 'strong'] as const
const METER = ['red', 'orange', 'yellow', 'green'] as const

type NewPasswordInputProps = Omit<PasswordInputProps, 'value'> & { value?: string; email: string }

// A new password with a live strength meter and requirements.
// Requirements get a green tick as they are met; unmet ones turn red only once the field has an error.
// A screen reader hears whether each one is met.
export default function NewPasswordInput({ value = '', email, error, ...props }: NewPasswordInputProps) {
  const { t } = useTranslation()
  const listId = useId()
  const checks = passwordChecks(value, email)
  const strength = passwordStrength(value.length)

  return (
    <Stack gap={6}>
      <PasswordField
        autoComplete="new-password"
        value={value}
        error={Boolean(error)}
        aria-describedby={listId}
        {...props}
      />
      <Group grow gap={4} aria-hidden>
        {[1, 2, 3, 4].map((level) => (
          <Progress key={level} size={4} value={strength >= level ? 100 : 0} color={METER[strength - 1] ?? 'gray'} />
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
      <List id={listId} listStyleType="none" spacing={4} center>
        {Object.entries(checks).map(([check, met]) => {
          const failed = !met && Boolean(error) && (check === 'length' || value.length > 0)
          const Icon = met ? IconCheck : failed ? IconX : IconCircle
          const color = met ? 'green' : failed ? 'var(--mantine-color-error)' : 'dimmed'
          return (
            <List.Item
              key={check}
              icon={
                <Text span c={color} lh={0}>
                  <Icon size={16} aria-hidden />
                </Text>
              }
            >
              <Text span size="sm" c={met ? undefined : color}>
                {t(`auth.requirements.${check as keyof typeof checks}`, { min: PASSWORD_MIN_LENGTH })}
                <VisuallyHidden>{t(met ? 'auth.requirementMet' : 'auth.requirementNotMet')}</VisuallyHidden>
              </Text>
            </List.Item>
          )
        })}
      </List>
      <Text size="xs" c="dimmed">
        {t('auth.passwordTip')}
      </Text>
    </Stack>
  )
}
