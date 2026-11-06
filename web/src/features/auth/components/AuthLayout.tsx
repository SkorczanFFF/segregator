import { Center, Container, Paper } from '@mantine/core'
import type { ReactNode } from 'react'
import AppControls from '~/shared/components/AppControls.tsx'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Center component="main" mih="100dvh" p="md" bg="var(--app-page-bg)">
      <AppControls />
      <Container size={440} w="100%" p={0}>
        <Paper>{children}</Paper>
      </Container>
    </Center>
  )
}
