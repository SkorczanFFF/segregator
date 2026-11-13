import { Group, Stack, Title } from '@mantine/core'
import type { ReactNode } from 'react'

type PageProps = { title: ReactNode; actions?: ReactNode; width?: number; children: ReactNode }

// A signed-in page, centered in the main area, with its title and actions on top.
export default function Page({ title, actions, width = 880, children }: PageProps) {
  return (
    <Stack gap="lg" maw={width} mx="auto">
      <Group justify="space-between">
        <Title>{title}</Title>
        {actions}
      </Group>
      {children}
    </Stack>
  )
}
