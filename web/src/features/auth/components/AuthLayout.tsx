import { Affix, Center, Flex, Paper } from '@mantine/core'
import type { ReactNode } from 'react'
import BrandPanel from '~/features/auth/components/BrandPanel.tsx'
import AppControls from '~/shared/components/AppControls.tsx'

// Brand panel beside a card with the content; on a phone the panel shrinks to a header above it.
export default function AuthLayout({ children }: { children: ReactNode }) {
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
        <Paper w="100%" maw={440} p={{ base: 'lg', sm: 'xl' }}>
          {children}
        </Paper>
      </Center>
    </Flex>
  )
}
