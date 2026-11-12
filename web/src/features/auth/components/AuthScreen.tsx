import { Anchor, Divider, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import AuthLayout from '~/features/auth/components/AuthLayout.tsx'
import GoogleButton from '~/shared/components/GoogleButton.tsx'
import { APP_NAME } from '~/shared/lib/app.ts'

type AuthScreenProps = {
  title: string
  google?: boolean
  footer?: ReactNode
  children: ReactNode
}

export default function AuthScreen({ title, google = true, footer, children }: AuthScreenProps) {
  const { t } = useTranslation()

  return (
    <AuthLayout>
      <Stack gap="lg">
        <Stack gap="xs">
          <Anchor component={Link} to="/" size="lg" fw={600} ff="heading" w="fit-content">
            {APP_NAME}
          </Anchor>
          <Title>{title}</Title>
        </Stack>
        {children}
        {google && (
          <>
            <Divider label={t('common.or')} labelPosition="center" />
            <GoogleButton />
          </>
        )}
        {footer && (
          <Text size="sm" ta="center">
            {footer}
          </Text>
        )}
      </Stack>
    </AuthLayout>
  )
}
