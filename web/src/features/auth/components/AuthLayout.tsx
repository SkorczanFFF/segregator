import { Affix, Anchor, Center, Flex, Paper, Stack } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import BrandPanel from '~/features/auth/components/BrandPanel.tsx'
import AppControls from '~/shared/components/AppControls.tsx'

// Brand panel beside a card with the content; on a phone the panel shrinks to a header above it.
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <Flex mih="100dvh" wrap="wrap">
      {/* On a phone the brand panel's top row has them, beside the logo. */}
      <Affix position={{ top: 16, right: 16 }} visibleFrom="sm">
        <AppControls />
      </Affix>
      <Flex flex="9 1 480px">
        <BrandPanel />
      </Flex>
      <Center component="main" px="md" py={{ base: 32, sm: 80 }} flex="11 1 420px">
        <Stack w="100%" maw={440} gap="md" align="center">
          <Paper w="100%" p={{ base: 'lg', sm: 'xl' }}>
            {children}
          </Paper>
          <Anchor component={Link} to="/privacy" size="sm" c="dimmed">
            {t('privacy.title')}
          </Anchor>
        </Stack>
      </Center>
    </Flex>
  )
}
