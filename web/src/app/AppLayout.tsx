import { AppShell, Button, Divider, Group, NavLink, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconFileText, IconFolder, IconLogout, IconPlus, IconUser } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import classes from '~/app/AppLayout.module.css'
import decor from '~/app/decor.module.css'
import { useSession, useSignOut } from '~/features/auth/session.ts'
import AppControls from '~/shared/components/AppControls.tsx'
import Logo from '~/shared/components/Logo.tsx'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'

const NAV = [
  { to: '/documents', label: 'app.nav.documents', icon: IconFileText },
  { to: '/account', label: 'app.nav.account', icon: IconUser },
] as const

type MenuLink = (typeof NAV)[number] & { active: boolean }

// A page in the menu at the bottom of a phone's screen.
function Tab({ to, label, icon: Icon, active }: MenuLink) {
  const { t } = useTranslation()
  return (
    <UnstyledButton component={Link} to={to} aria-current={active ? 'page' : undefined} className={classes.tab}>
      <span className={classes.tabIcon}>
        <Icon size={22} aria-hidden />
      </span>
      {t(label)}
    </UnstyledButton>
  )
}

// A document's own page or a new one, where the form's buttons take the bottom of a phone's screen in place of
// the menu.
const DOCUMENT_PAGE = /^\/documents\/./

// The signed-in frame: header, menu and the page. On a wider screen the menu is at the side and ends with the
// language, the color scheme and signing out. On a phone it is a bar at the bottom with adding a document in
// its middle, and the account page holds the rest.
export default function AppLayout() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { user } = useSession()
  const signOut = useSignOut('/auth/logout')
  const isActive = (to: string) => pathname.startsWith(to)
  const [documents, account] = NAV
  const documentPage = DOCUMENT_PAGE.test(pathname)

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: true } }}
      footer={documentPage ? undefined : { height: { base: 72, sm: 0 } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Logo to="/documents" />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          <Stack gap={6}>
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                component={Link}
                to={to}
                label={t(label)}
                leftSection={
                  <Icon size={18} color={isActive(to) ? 'var(--mantine-color-saffron-filled)' : undefined} aria-hidden />
                }
                active={isActive(to)}
                className={classes.link}
              />
            ))}
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <Divider mb="md" />
          <Stack gap="md">
            <AppControls withLabels />
            <Divider />
            <Stack gap="xs">
              <Text size="sm" c="dimmed" truncate>
                {user?.email}
              </Text>
              <Button
                variant="default"
                size="sm"
                leftSection={<IconLogout size={18} aria-hidden />}
                loading={signOut.pending}
                onClick={() => void signOut.submit(undefined)}
              >
                {t('app.signOut')}
              </Button>
            </Stack>
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main bg="var(--app-page-bg)" className={classes.main}>
        <IconFolder size={420} stroke={0.6} className={classes.watermark} aria-hidden />
        <ApiErrorAlert code={signOut.error} mb="lg" />
        <Outlet />
      </AppShell.Main>
      {!documentPage && (
        <AppShell.Footer hiddenFrom="sm">
          <nav aria-label={t('app.menu')} className={classes.bar}>
            <Tab {...documents} active={isActive(documents.to)} />
            <Button
              component={Link}
              to="/documents/new"
              size="lg"
              leftSection={<IconPlus size={20} aria-hidden />}
              className={`${decor.stamp} ${classes.add}`}
            >
              {t('app.nav.add')}
            </Button>
            <Tab {...account} active={isActive(account.to)} />
          </nav>
        </AppShell.Footer>
      )}
    </AppShell>
  )
}
