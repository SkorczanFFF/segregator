import { Button, Group, Modal, Paper, Stack, Text, type MantineColor } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import type { ApiErrorCode } from '~/shared/lib/api.ts'

type ConfirmModalProps = {
  opened: boolean
  onClose: () => void
  title: string
  // What the action applies to, set apart on the page's ground, e.g. the document.
  subject?: ReactNode
  // What follows from it, and anything to fill in before it.
  children: ReactNode
  confirm: { label: string; color: MantineColor; disabled?: boolean }
  pending: boolean
  error?: ApiErrorCode
  onConfirm: () => void
}

// Asks before an action that can't be undone or that uses something up, showing what it applies to and what follows.
export default function ConfirmModal(props: ConfirmModalProps) {
  const { opened, onClose, title, subject, children, confirm, pending, error, onConfirm } = props
  const { t } = useTranslation()

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text component="span" ff="heading" fw={600} fz="xl">
          {title}
        </Text>
      }
      centered
    >
      <Stack gap="md">
        {subject && (
          <Paper p="sm" shadow="none" bg="var(--app-page-bg)">
            {subject}
          </Paper>
        )}
        {children}
        <ApiErrorAlert code={error} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="filled" color={confirm.color} disabled={confirm.disabled} loading={pending} onClick={onConfirm}>
            {confirm.label}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
