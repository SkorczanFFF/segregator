import { Button, Group, Modal, Stack, Text, TextInput, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { RESTORE_DAYS } from 'shared'
import { useSession } from '~/features/auth/session.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api } from '~/shared/lib/api.ts'

// Deletes the account for good, once its address is typed again. The entry page then says it is gone.
export default function DeleteAccount() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, setUser } = useSession()
  const [confirming, { open, close }] = useDisclosure()
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === user?.email.toLowerCase()
  const remove = useApiSubmit(async () => {
    await api.delete('/account', { email: typed })
    setUser(null)
    navigate('/', { replace: true, state: { accountDeleted: true } })
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
      <Modal opened={confirming} onClose={close} title={t('account.deleteConfirmTitle')} centered>
        <Stack gap="md">
          <Text>{t('account.deleteConfirmText', { days: RESTORE_DAYS })}</Text>
          <TextInput
            label={t('account.deleteEmailLabel')}
            value={typed}
            onChange={(event) => setTyped(event.currentTarget.value)}
            type="email"
            autoComplete="off"
            data-autofocus
          />
          <ApiErrorAlert code={remove.error} />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              {t('documents.cancel')}
            </Button>
            <Button
              variant="filled"
              color="red.9"
              disabled={!matches}
              loading={remove.pending}
              onClick={() => void remove.submit(undefined)}
            >
              {t('account.deleteConfirm')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
