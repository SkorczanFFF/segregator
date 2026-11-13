import { Button, Group, Modal, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import type { Document, DocumentInput } from 'shared'
import DocumentForm from '~/features/documents/components/DocumentForm.tsx'
import { documentKey, refreshDocuments } from '~/features/documents/useDocuments.ts'
import Page from '~/shared/components/Page.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api, errorCode } from '~/shared/lib/api.ts'

export default function DocumentPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, { open, close }] = useDisclosure()
  const { data: doc, error } = useQuery({
    queryKey: documentKey(id),
    queryFn: () => api.get<Document>(`/documents/${id}`),
  })

  async function save(input: DocumentInput) {
    queryClient.setQueryData(documentKey(id), await api.put<Document>(`/documents/${id}`, input))
    await refreshDocuments(queryClient)
    navigate('/documents')
  }

  const remove = useApiSubmit(async () => {
    await api.delete(`/documents/${id}`)
    await refreshDocuments(queryClient)
    navigate('/documents')
  })

  return (
    <Page title={doc ? (doc.title ?? doc.issuer) : t('documents.document')} width={560}>
      {error && <StatusAlert status="error">{t(`errors.${errorCode(error)}`)}</StatusAlert>}
      {!doc && !error && (
        <Paper aria-busy>
          <Skeleton h={320} />
        </Paper>
      )}
      {doc && (
        <DocumentForm
          key={doc.id}
          doc={doc}
          onSave={save}
          extraAction={
            <Button variant="subtle" color="red" mr="auto" onClick={open}>
              {t('documents.delete')}
            </Button>
          }
        />
      )}
      <Modal opened={confirming} onClose={close} title={t('documents.deleteTitle')} centered>
        <Stack gap="md">
          <Text>{t('documents.deleteText')}</Text>
          {remove.error && <StatusAlert status="error">{t(`errors.${remove.error}`)}</StatusAlert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              {t('documents.cancel')}
            </Button>
            <Button variant="filled" color="red.9" loading={remove.pending} onClick={() => void remove.submit(undefined)}>
              {t('documents.deleteConfirm')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Page>
  )
}
