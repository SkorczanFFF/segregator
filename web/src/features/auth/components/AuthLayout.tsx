import { Box, Center, Flex } from '@mantine/core'
import type { ReactNode } from 'react'
import BrandPanel from '~/features/auth/components/BrandPanel.tsx'
import AppControls from '~/shared/components/AppControls.tsx'

// Brand panel beside the content; on a phone the panel shrinks to a header above it.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Flex mih="100dvh" wrap="wrap">
      <AppControls />
      <Flex flex="9 1 480px">
        <BrandPanel />
      </Flex>
      <Center component="main" px="md" py={{ base: 48, sm: 80 }} flex="11 1 420px">
        <Box w="100%" maw={400}>
          {children}
        </Box>
      </Center>
    </Flex>
  )
}
