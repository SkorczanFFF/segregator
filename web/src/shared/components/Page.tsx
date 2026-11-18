import { Anchor, Group, Stack, Title } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

type PageProps = {
  title: ReactNode
  actions?: ReactNode
  // A link above the title, back to where the page was opened from.
  back?: { to: string; label: string }
  width?: number
  children: ReactNode
}

// A page centered in the main area, with its title and actions on top.
// Positioned, so it stays above the layout's watermark.
export default function Page({ title, actions, back, width = 880, children }: PageProps) {
  return (
    <Stack gap="lg" maw={width} mx="auto" pos="relative">
      <Stack gap={6}>
        {back && (
          <Anchor component={Link} to={back.to} size="sm" fw={600} w="fit-content">
            <Group gap={6}>
              <IconArrowLeft size={16} aria-hidden />
              {back.label}
            </Group>
          </Anchor>
        )}
        <Group justify="space-between">
          <Title>{title}</Title>
          {actions}
        </Group>
      </Stack>
      {children}
    </Stack>
  )
}
