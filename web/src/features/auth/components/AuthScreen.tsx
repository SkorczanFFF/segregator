import { Divider, Group, Progress, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import AuthLayout from '~/features/auth/components/AuthLayout.tsx'
import GoogleButton from '~/shared/components/GoogleButton.tsx'

type Step = { current: number; total: number; label: string }

type AuthScreenProps = {
  title: string
  description?: ReactNode
  step?: Step
  google?: boolean
  footer?: ReactNode
  children: ReactNode
}

export default function AuthScreen({
  title,
  description,
  step,
  google = true,
  footer,
  children,
}: AuthScreenProps) {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <Stack gap={28}>
        {step && (
          <Stack gap={6}>
            <Text size="sm" fw={600} c="dimmed">
              {t('auth.step', step)}
            </Text>
            <Group grow gap={4} aria-hidden>
              {Array.from({ length: step.total }, (_, i) => (
                <Progress key={i} size={4} value={i < step.current ? 100 : 0} />
              ))}
            </Group>
          </Stack>
        )}
        <Stack gap="xs">
          <Title>{title}</Title>
          {description && <Text c="dimmed">{description}</Text>}
        </Stack>
        {google && (
          <>
            <GoogleButton />
            <Divider label={t('auth.orEmail')} labelPosition="center" />
          </>
        )}
        {children}
        {footer && (
          <Text size="sm" c="dimmed">
            {footer}
          </Text>
        )}
      </Stack>
    </AuthLayout>
  )
}
