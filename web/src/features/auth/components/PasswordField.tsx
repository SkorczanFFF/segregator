import { Group, PasswordInput, Text, type PasswordInputProps } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// A password, with a note under it while Caps Lock is on.
export default function PasswordField({ onKeyUp, onBlur, ...props }: PasswordInputProps) {
  const { t } = useTranslation()
  const [capsLock, setCapsLock] = useState(false)

  return (
    <>
      <PasswordInput
        {...props}
        onKeyUp={(event) => {
          setCapsLock(event.getModifierState('CapsLock'))
          onKeyUp?.(event)
        }}
        onBlur={(event) => {
          setCapsLock(false)
          onBlur?.(event)
        }}
      />
      {capsLock && (
        <Group gap={6} c="orange" role="status">
          <IconAlertTriangle size={16} aria-hidden />
          <Text size="sm">{t('auth.capsLock')}</Text>
        </Group>
      )}
    </>
  )
}
