import { Anchor, AppShell, Burger, Group, NavLink, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconFileText, IconUser } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { useSession } from '~/features/auth/session.ts'
import AppControls from '~/shared/components/AppControls.tsx'
import { APP_NAME } from '~/shared/lib/app.ts'

const NAV = [
  { to: '/documents', label: 'app.nav.documents', icon: IconFileText },
  { to: '/account', label: 'app.nav.account', icon: IconUser },
] as const

// The signed-in frame: header, side menu and the page. On a phone the menu opens from the header.
export default function AppLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { user } = useSession()
  const [opened, { toggle, close }] = useDisclosure()

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label={t('app.menu')} />
          <Anchor component={Link} to="/documents" ff="heading" fw={600} fz={22} underline="never">
            {APP_NAME}
          </Anchor>
        </Group>
        <AppControls />
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              component={Link}
              to={to}
              label={t(label)}
              leftSection={<Icon size={18} aria-hidden />}
              active={pathname.startsWith(to)}
              onClick={close}
            />
          ))}
        </AppShell.Section>
        <AppShell.Section>
          <Text size="sm" c="dimmed" truncate>
            {user?.email}
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main bg="var(--app-page-bg)">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
