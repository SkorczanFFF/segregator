import { Anchor, Badge, Box, Divider, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { APP_NAME } from '~/shared/lib/app.ts'

const STEPS = ['add', 'check', 'remind'] as const

// A receipt with a torn edge, showing what the app reads from a document.
function SampleReceipt() {
  const { t } = useTranslation()

  return (
    <Paper
      visibleFrom="sm"
      w={300}
      p="lg"
      pb={28}
      radius={0}
      shadow="none"
      withBorder={false}
      bg="brand.0"
      c="dark.8"
      pos="relative"
      style={{ transform: 'rotate(-2deg)', borderRadius: '4px 4px 0 0' }}
      aria-hidden
    >
      <Stack gap="xs">
        <Text ff="monospace" fz={11} c="dark.4" style={{ letterSpacing: '0.08em' }}>
          {t('brand.receipt.meta')}
        </Text>
        <Text ff="heading" fw={600} fz={20}>
          {t('brand.receipt.shop')}
        </Text>
        <Group justify="space-between" fz="sm">
          <span>{t('brand.receipt.item')}</span>
          <Text span ff="monospace" fz="sm">
            {t('brand.receipt.amount')}
          </Text>
        </Group>
        <Divider variant="dashed" color="dark.3" />
        <Group gap="xs">
          <Badge bg="brand.1" c="brand.9" tt="none">
            {t('brand.receipt.warranty')}
          </Badge>
          <Badge bg="white" c="dark.4" tt="none" fw={500} bd="1px solid var(--mantine-color-dark-1)">
            {t('brand.receipt.reminder')}
          </Badge>
        </Group>
      </Stack>
      <Group justify="space-between" pos="absolute" left={2} right={2} bottom={-8} gap={0}>
        {Array.from({ length: 16 }, (_, i) => (
          <Box key={i} w={16} h={16} bg="brand.9" style={{ borderRadius: '50%' }} />
        ))}
      </Group>
    </Paper>
  )
}

export default function BrandPanel() {
  const { t } = useTranslation()

  return (
    <Stack
      component="aside"
      justify="space-between"
      gap="xl"
      w="100%"
      p={{ base: 'lg', sm: 48 }}
      bg="brand.9"
      c="brand.0"
      style={{ overflow: 'hidden' }}
    >
      <Anchor component={Link} to="/" ff="heading" fw={600} fz={22} c="brand.2" underline="never" w="fit-content">
        {APP_NAME}
      </Anchor>
      <Stack gap="md" maw={440}>
        <Title order={2} c="brand.0" fz={{ base: 28, sm: 44 }} lh={1.1}>
          {t('brand.headline')}
        </Title>
        <Text c="brand.2" lh={1.6}>
          {t('brand.lead')}
        </Text>
      </Stack>
      <SampleReceipt />
      <Stack component="ol" gap="sm" m={0} p={0} visibleFrom="sm" style={{ listStyle: 'none' }}>
        {STEPS.map((step, i) => (
          <Group component="li" key={step} gap="md" align="baseline">
            <Text span ff="monospace" fw={700} fz={13} c="brand.3">
              {i + 1}
            </Text>
            <Text span fz={15}>
              {t(`brand.steps.${step}`)}
            </Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  )
}
