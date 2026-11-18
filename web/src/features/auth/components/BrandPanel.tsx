import { Badge, Box, Group, Image, List, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconSparkles } from '@tabler/icons-react'
import { Trans, useTranslation } from 'react-i18next'
import classes from '~/features/auth/components/BrandPanel.module.css'
import sampleReceipt from '~/features/auth/components/sample-receipt.svg'
import Logo from '~/shared/components/Logo.tsx'
import PreferencesMenu from '~/shared/components/PreferencesMenu.tsx'
import SpineMark from '~/shared/components/SpineMark.tsx'
import { formatDate, formatMoney } from '~/shared/lib/format.ts'

const STEPS = ['add', 'straighten', 'check'] as const

function ReadRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Group justify="space-between" fz="sm" wrap="nowrap">
      <Text span c="dimmed" inherit>
        {label}
      </Text>
      <Text span fw={mono ? undefined : 600} ff={mono ? 'monospace' : undefined} inherit>
        {value}
      </Text>
    </Group>
  )
}

// A photo of a receipt beside what the app reads from it, which is the app's main idea.
function SampleRead() {
  const { t } = useTranslation()

  return (
    <Group gap={0} wrap="nowrap" visibleFrom="sm" aria-hidden>
      <Image src={sampleReceipt} h={240} w={180} radius="md" className={classes.photo} />
      {/* The card follows the color scheme, unlike the always dark panel around it. */}
      <Paper p="md" w={250} ml={-36} shadow="xl" c="var(--mantine-color-text)" className={classes.read}>
        <Stack gap={10}>
          <Group gap={6} fz="xs" fw={700} tt="uppercase" lts="0.04em" className={classes.readTitle}>
            <IconSparkles size={16} />
            {t('brand.sample.read')}
          </Group>
          <ReadRow label={t('documents.fields.issuer')} value={t('brand.sample.issuer')} />
          <ReadRow label={t('documents.fields.amount')} value={formatMoney(189900)} mono />
          <ReadRow label={t('documents.fields.docDate')} value={formatDate('2026-11-12')} mono />
          <Badge color="saffron" variant="light" radius="sm" tt="none" fw={500} size="lg">
            {t('categories.types.receipt')} · {t('categories.subtypes.appliances')}
          </Badge>
        </Stack>
      </Paper>
    </Group>
  )
}

export default function BrandPanel() {
  const { t } = useTranslation()

  return (
    <Box component="aside" w="100%" p={{ base: 'lg', sm: 48 }} bg="brand.9" c="brand.0" className={classes.panel}>
      <SpineMark className={classes.watermark} />
      <Stack justify="space-between" gap="xl" h="100%" pos="relative">
        <Group justify="space-between" wrap="nowrap">
          <Logo to="/" c="brand.2" onBrand />
          <PreferencesMenu />
        </Group>
        <Stack gap="md" maw={460}>
          <Title order={2} c="brand.0" fz={{ base: 28, sm: 44 }} lh={1.1}>
            <Trans i18nKey="brand.headline" components={{ accent: <Text span inherit c="saffron.5" /> }} />
          </Title>
          <Text c="brand.2" lh={1.6} visibleFrom="sm">
            {t('brand.lead')}
          </Text>
        </Stack>
        <SampleRead />
        <List type="ordered" listStyleType="none" spacing="sm" center fz={{ base: 14, sm: 15 }} c="inherit">
          {STEPS.map((step, i) => (
            <List.Item
              key={step}
              icon={
                <ThemeIcon size={26} radius="xl" color="saffron.5" variant={i === 0 ? 'filled' : 'outline'}>
                  <Text span ff="monospace" fw={700} fz={13}>
                    {i + 1}
                  </Text>
                </ThemeIcon>
              }
            >
              {t(`brand.steps.${step}`)}
            </List.Item>
          ))}
        </List>
      </Stack>
    </Box>
  )
}
