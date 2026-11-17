import {
  Center,
  Group,
  SegmentedControl,
  Stack,
  Text,
  Tooltip,
  useMantineColorScheme,
  VisuallyHidden,
  type MantineColorScheme,
} from '@mantine/core'
import { IconDeviceDesktop, IconMoon, IconSun, type Icon } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import classes from '~/shared/components/AppControls.module.css'
import { LANGUAGES } from '~/shared/i18n/index.ts'

// Auto follows the device's setting.
const SCHEMES: { value: MantineColorScheme; icon: Icon }[] = [
  { value: 'light', icon: IconSun },
  { value: 'dark', icon: IconMoon },
  { value: 'auto', icon: IconDeviceDesktop },
]

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      {children}
    </Group>
  )
}

// Language and color scheme, each picked from all its options. With labels in the side menu and on a phone's
// account page, without them in a corner of the entry pages.
export default function AppControls({ withLabels = false }: { withLabels?: boolean }) {
  const { t, i18n } = useTranslation()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const language = (
    <SegmentedControl
      size="sm"
      className={classes.accent}
      aria-label={t('common.language')}
      value={i18n.language}
      onChange={(value) => void i18n.changeLanguage(value)}
      data={LANGUAGES.map((value) => ({ value, label: value.toUpperCase() }))}
    />
  )
  const scheme = (
    <SegmentedControl
      size="sm"
      className={classes.accent}
      aria-label={t('common.colorScheme')}
      value={colorScheme}
      onChange={(value) => setColorScheme(value as MantineColorScheme)}
      data={SCHEMES.map(({ value, icon: SchemeIcon }) => ({
        value,
        label: (
          <Tooltip label={t(`common.schemes.${value}`)}>
            {/* As tall as a line of text, so the icon segments match PL and EN. */}
            <Center h="calc(1em * var(--mantine-line-height))">
              <SchemeIcon size={16} aria-hidden />
              <VisuallyHidden>{t(`common.schemes.${value}`)}</VisuallyHidden>
            </Center>
          </Tooltip>
        ),
      }))}
    />
  )

  if (!withLabels) {
    return (
      <Group gap="xs">
        {language}
        {scheme}
      </Group>
    )
  }
  return (
    <Stack gap="xs">
      <Labeled label={t('common.language')}>{language}</Labeled>
      <Labeled label={t('common.colorScheme')}>{scheme}</Labeled>
    </Stack>
  )
}
