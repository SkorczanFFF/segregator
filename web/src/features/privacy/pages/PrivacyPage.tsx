import { Box, Group, List, Paper, Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import AppControls from '~/shared/components/AppControls.tsx'
import Logo from '~/shared/components/Logo.tsx'
import Page from '~/shared/components/Page.tsx'
import PreferencesMenu from '~/shared/components/PreferencesMenu.tsx'
import { formatDate } from '~/shared/lib/format.ts'

// The data controller the policy names, and the day the policy took effect.
const CONTROLLER = { name: 'Maciej Skorus', email: 'skorusmaciej94@gmail.com' }
const IN_FORCE = '2026-11-18'

// The privacy policy, open signed in or not.
export default function PrivacyPage() {
  const { t } = useTranslation()
  const sections = t('privacy.sections', { returnObjects: true, ...CONTROLLER })

  return (
    <Box mih="100dvh" bg="var(--app-page-bg)">
      <Group component="header" h={64} px="md" justify="space-between" wrap="nowrap">
        <Logo to="/" />
        <Box visibleFrom="sm">
          <AppControls />
        </Box>
        <PreferencesMenu />
      </Group>
      <Box component="main" px="md" pt="md" pb="xl">
        <Page title={t('privacy.title')} width={720}>
          <Paper p={{ base: 'lg', sm: 'xl' }}>
            <Stack gap="xl">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">
                  {t('privacy.inForce', { date: formatDate(IN_FORCE) })}
                </Text>
                <Text>{t('privacy.lead')}</Text>
              </Stack>
              {sections.map(({ title, text, list }) => (
                <Stack key={title} component="section" gap="xs">
                  <Title order={2} size="h4">
                    {title}
                  </Title>
                  {text?.map((paragraph) => <Text key={paragraph}>{paragraph}</Text>)}
                  {list && (
                    <List spacing={6}>
                      {list.map((item) => (
                        <List.Item key={item}>{item}</List.Item>
                      ))}
                    </List>
                  )}
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Page>
      </Box>
    </Box>
  )
}
