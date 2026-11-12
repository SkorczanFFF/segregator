import { Group, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export default function CapsLockNote() {
  const { t } = useTranslation()

  return (
    <Group gap={6} c="dimmed" role="status">
      <IconAlertTriangle size={16} aria-hidden />
      <Text size="sm">{t('auth.capsLock')}</Text>
    </Group>
  )
}
