import {
  ActionIcon,
  Affix,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

function ColorSchemeToggle() {
  const { t } = useTranslation()
  const { setColorScheme } = useMantineColorScheme()
  const colorScheme = useComputedColorScheme('light', {
    getInitialValueInEffect: false,
  })
  const isDark = colorScheme === 'dark'

  return (
    <Tooltip label={t('common.toggleColorScheme')}>
      <ActionIcon
        aria-label={t('common.toggleColorScheme')}
        onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  )
}

function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const nextLanguage = i18n.language === 'pl' ? 'en' : 'pl'

  return (
    <Tooltip label={t('common.switchLanguage')}>
      <ActionIcon
        ff="monospace"
        fz="xs"
        fw={700}
        aria-label={t('common.switchLanguage')}
        onClick={() => void i18n.changeLanguage(nextLanguage)}
      >
        {nextLanguage.toUpperCase()}
      </ActionIcon>
    </Tooltip>
  )
}

export default function AppControls() {
  return (
    <Affix position={{ top: 16, right: 16 }}>
      <ActionIcon.Group>
        <LanguageToggle />
        <ColorSchemeToggle />
      </ActionIcon.Group>
    </Affix>
  )
}
