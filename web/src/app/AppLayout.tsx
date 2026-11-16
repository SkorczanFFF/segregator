import { AppShell, Burger, Button, Divider, Group, NavLink, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconFileText, IconFolder, IconLogout, IconUser } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import classes from '~/app/AppLayout.module.css'
import { useSession, useSignOut } from '~/features/auth/session.ts'
import AppControls from '~/shared/components/AppControls.tsx'
import Logo from '~/shared/components/Logo.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'

const NAV = [
  { to: '/documents', label: 'app.nav.documents', icon: IconFileText },
  { to: '/account', label: 'app.nav.account', icon: IconUser },
] as const

// The signed-in frame: header, side menu and the page. The side menu ends with the language and color
// scheme. On a phone it opens from the header's menu button and also takes the email and sign-out.
export default function AppLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { user } = useSession()
  const [opened, { toggle, close }] = useDisclosure()
  const signOut = useSignOut('/auth/logout')
  const signOutButton = (
    <Button
      variant="light"
      color="red"
      size="sm"
      leftSection={<IconLogout size={18} />}
      loading={signOut.pending}
      onClick={() => void signOut.submit(undefined)}
    >
      {t('app.signOut')}
    </Button>
  )

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm" wrap="nowrap">
          <Logo to="/documents" />
          <Group gap="sm" ml="auto" wrap="nowrap" visibleFrom="sm">
            <Text size="sm" c="dimmed">
              {user?.email}
            </Text>
            {signOutButton}
          </Group>
          <Burger
            opened={opened}
            onClick={toggle}
            hiddenFrom="sm"
            ml="auto"
            color="saffron.5"
            aria-label={t('app.menu')}
          />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to)
            return (
              <NavLink
                key={to}
                component={Link}
                to={to}
                label={t(label)}
                leftSection={
                  <Icon size={18} color={active ? 'var(--mantine-color-saffron-filled)' : undefined} aria-hidden />
                }
                active={active}
                onClick={close}
              />
            )
          })}
        </AppShell.Section>
        <AppShell.Section>
          <Divider mb="md" />
          <Stack gap="md">
            <AppControls withLabels />
            <Group justify="space-between" wrap="nowrap" hiddenFrom="sm">
              <Text size="sm" c="dimmed" truncate>
                {user?.email}
              </Text>
              {signOutButton}
            </Group>
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main bg="var(--app-page-bg)" className={classes.main}>
        <IconFolder size={420} stroke={0.6} className={classes.watermark} aria-hidden />
        {signOut.error && (
          <StatusAlert status="error" mb="lg">
            {t(`errors.${signOut.error}`)}
          </StatusAlert>
        )}
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
