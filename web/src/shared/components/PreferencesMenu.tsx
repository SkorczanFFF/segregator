import { ActionIcon, Popover } from '@mantine/core'
import { IconAdjustmentsHorizontal } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import AppControls from '~/shared/components/AppControls.tsx'

// On a phone, one button that opens the language and the color scheme.
export default function PreferencesMenu() {
  const { t } = useTranslation()
  return (
    <Popover position="bottom-end" width={260} shadow="md">
      <Popover.Target>
        <ActionIcon variant="light" color="saffron" hiddenFrom="sm" aria-label={t('common.preferences')}>
          <IconAdjustmentsHorizontal size={18} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <AppControls withLabels />
      </Popover.Dropdown>
    </Popover>
  )
}
