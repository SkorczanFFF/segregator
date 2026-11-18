import { Button, Group, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconUser } from '@tabler/icons-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DeleteAccountInput } from 'shared'
import { useEndSession, useSession } from '~/features/auth/session.ts'
import ConfirmModal from '~/shared/components/ConfirmModal.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { useStorageUse } from '~/shared/hooks/useUsage.ts'
import { api } from '~/shared/lib/api.ts'
import { formatFileSize } from '~/shared/lib/format.ts'

// Deletes the account for good, once its address is typed again. The entry page then says it is gone.
export default function DeleteAccount() {
  const { t } = useTranslation()
  const { user } = useSession()
  const endSession = useEndSession()
  const storage = useStorageUse()
  const [confirming, { open, close }] = useDisclosure()
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === user?.email.toLowerCase()
  const remove = useApiSubmit(async () => {
    await api.delete('/account', { email: typed } satisfies DeleteAccountInput)
    endSession({ accountDeleted: true })
  })

  return (
    <Stack gap="sm">
      <Title order={2} size="h4">
        {t('account.deleteTitle')}
      </Title>
      <Text size="sm" c="dimmed">
        {t('account.deleteHint')}
      </Text>
      <Button variant="outline" color="red" fullWidth onClick={open}>
        {t('account.deleteOpen')}
      </Button>
      <ConfirmModal
        opened={confirming}
        onClose={() => {
          close()
          setTyped('')
        }}
        title={t('account.deleteConfirmTitle')}
        subject={
          <Group wrap="nowrap" gap="md">
            <ThemeIcon variant="light" size={44} radius="md">
              <IconUser size={26} stroke={1.5} aria-hidden />
            </ThemeIcon>
            <Stack gap={2} miw={0}>
              <Text fw={600} truncate>
                {user?.email}
              </Text>
              {storage.data && (
                <Text size="sm" c="dimmed">
                  {t('account.deleteFiles', { size: formatFileSize(storage.data.used) })}
                </Text>
              )}
            </Stack>
          </Group>
        }
        confirm={{ label: t('account.deleteConfirm'), color: 'red.9', disabled: !matches }}
        pending={remove.pending}
        error={remove.error}
        onConfirm={() => void remove.submit(undefined)}
      >
        <Text>{t('account.deleteConfirmText')}</Text>
        <TextInput
          label={t('account.deleteEmailLabel')}
          value={typed}
          onChange={(event) => setTyped(event.currentTarget.value)}
          type="email"
          autoComplete="off"
          data-autofocus
        />
      </ConfirmModal>
    </Stack>
  )
}
