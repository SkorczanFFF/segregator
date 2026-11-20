import {
  AppShell,
  Badge,
  Button,
  Divider,
  Group,
  NavLink,
  Stack,
  Text,
  UnstyledButton,
  type MantineColor,
} from '@mantine/core'
import { IconFiles, IconFileText, IconLogout, IconPlus, IconUser, type Icon } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { DOCUMENT_TYPES } from 'shared'
import classes from '~/app/AppLayout.module.css'
import decor from '~/app/decor.module.css'
import { useSession, useSignOut } from '~/features/auth/session.ts'
import { categoryOf, fromList, isList, listOf, listPath } from '~/features/documents/filters.ts'
import { listName, TYPE_LOOKS } from '~/features/documents/look.ts'
import { useMenuCategories } from '~/features/documents/useMenuCategories.ts'
import AppControls from '~/shared/components/AppControls.tsx'
import Logo from '~/shared/components/Logo.tsx'
import SpineMark from '~/shared/components/SpineMark.tsx'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'

const NAV = [
  { to: listPath(), label: 'app.nav.documents', icon: IconFileText },
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

type MenuIconProps = { icon: Icon; active: boolean; color?: MantineColor }

// An icon in the side menu, in its type's color, or saffron while its page is open.
function MenuIcon({ icon: Icon, active, color }: MenuIconProps) {
  return (
    <Icon
      size={18}
      color={color ? `var(--mantine-color-${color}-filled)` : active ? 'var(--mantine-color-saffron-filled)' : undefined}
      aria-hidden
    />
  )
}

// A page in the side menu.
function SideLink({ to, label, ...look }: MenuIconProps & { to: string; label: string }) {
  const { pathname } = useLocation()
  return (
    <NavLink
      component={Link}
      to={to}
      label={label}
      leftSection={<MenuIcon {...look} />}
      active={look.active}
      aria-current={pathname === to ? 'page' : undefined}
      className={classes.link}
    />
  )
}

// The signed-in frame: header, menu and the page. On a wider screen the menu is at the side, where the documents
// open into all of them and each category, and ends with the language, the color scheme and signing out. On a
// phone it is a bar at the bottom with adding a document in its middle, and the account page holds the rest.
export default function AppLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { pathname } = location
  const { user } = useSession()
  const signOut = useSignOut('/auth/logout')
  const isActive = (to: string) => pathname.startsWith(to)
  const [documents, account] = NAV
  const inDocuments = isActive(documents.to)
  // A document's own page or a new one, where the form's buttons take the bottom of a phone's screen in place
  // of the menu.
  const documentPage = inDocuments && !isList(pathname)
  // The category whose list is open, or which the open document was opened from.
  const category = inDocuments ? categoryOf(listOf(location)) : undefined
  const [categoriesShown, setCategoriesShown] = useMenuCategories()
  // With the list hidden, the documents stand for whichever of them is open.
  const documentsActive = inDocuments && !categoriesShown

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: true } }}
      footer={documentPage ? undefined : { height: { base: 72, sm: 0 } }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Logo to="/documents" />
          {user?.demo && (
            <Group gap="sm" wrap="nowrap">
              <Badge color="saffron" radius="sm" size="lg">
                {t('app.demo')}
              </Badge>
              <Text size="sm" c="dimmed" visibleFrom="md">
                {t('app.demoHint')}
              </Text>
              <Button
                variant="default"
                size="compact-sm"
                loading={signOut.pending}
                onClick={() => void signOut.submit(undefined)}
              >
                {t('app.demoEnd')}
              </Button>
            </Group>
          )}
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <AppShell.Section grow>
          <Stack gap={6}>
            {/* The whole row shows and hides all the documents and their categories. */}
            <NavLink
              component="button"
              label={t(documents.label)}
              leftSection={<MenuIcon icon={documents.icon} active={documentsActive} />}
              opened={categoriesShown}
              onChange={setCategoriesShown}
              childrenOffset={0}
              active={documentsActive}
              className={classes.link}
            >
              <Stack gap={2} pt={2} className={classes.categories}>
                <SideLink to={documents.to} label={t('app.nav.all')} icon={IconFiles} active={inDocuments && !category} />
                {DOCUMENT_TYPES.map((type) => (
                  <SideLink
                    key={type}
                    to={listPath(type)}
                    label={listName(t, type)}
                    icon={TYPE_LOOKS[type].icon}
                    color={TYPE_LOOKS[type].color}
                    active={category === type}
                  />
                ))}
              </Stack>
            </NavLink>
            <SideLink {...account} label={t(account.label)} active={isActive(account.to)} />
          </Stack>
        </AppShell.Section>
        <AppShell.Section>
          <Divider mb="md" />
          <Stack gap="md">
            <AppControls withLabels />
            <Divider />
            <Stack gap="xs">
              <Text size="sm" c="dimmed" truncate>
                {user?.demo ? t('app.demoAccount') : user?.email}
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
        <SpineMark className={classes.watermark} />
        <ApiErrorAlert code={signOut.error} mb="lg" />
        <Outlet />
      </AppShell.Main>
      {!documentPage && (
        <AppShell.Footer hiddenFrom="sm">
          <nav aria-label={t('app.menu')} className={classes.bar}>
            <Tab {...documents} active={inDocuments} />
            {!user?.demo && (
              <Button
                component={Link}
                to="/documents/new"
                state={fromList(location)}
                size="lg"
                leftSection={<IconPlus size={20} aria-hidden />}
                className={`${decor.stamp} ${classes.add}`}
              >
                {t('app.nav.add')}
              </Button>
            )}
            <Tab {...account} active={isActive(account.to)} />
          </nav>
        </AppShell.Footer>
      )}
    </AppShell>
  )
}
