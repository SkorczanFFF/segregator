import { Button, Group, Modal, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router'
import type { Document, DocumentInput } from 'shared'
import DocumentForm from '~/features/documents/components/DocumentForm.tsx'
import ReadPanel from '~/features/documents/components/ReadPanel.tsx'
import SavedFile from '~/features/documents/components/SavedFile.tsx'
import { documentName, PAGE_WIDTH } from '~/features/documents/look.ts'
import { documentKey, isReading, refreshDocuments, useDocument, useReadOutcome } from '~/features/documents/useDocuments.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import Page from '~/shared/components/Page.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api, errorCode } from '~/shared/lib/api.ts'
import { formatDay } from '~/shared/lib/format.ts'

export default function DocumentPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, { open, close }] = useDisclosure()
  const { data: doc, error } = useDocument(id)
  const reading = isReading(doc)
  // Files saved before pages were counted can't be read.
  const readable = doc?.file?.pages !== undefined
  const { outcome, suggestion } = useReadOutcome(doc)

  async function save(input: DocumentInput) {
    queryClient.setQueryData(documentKey(id), await api.put<Document>(`/documents/${id}`, input))
    await refreshDocuments(queryClient)
    navigate('/documents')
  }

  const remove = useApiSubmit(async () => {
    await api.delete(`/documents/${id}`)
    await refreshDocuments(queryClient)
    navigate('/documents')
    queryClient.removeQueries({ queryKey: documentKey(id), exact: true })
  })

  // A draft goes on where new documents are made.
  if (doc?.draft) return <Navigate to={`/documents/new?draft=${doc.id}`} replace />

  return (
    <Page
      title={doc ? documentName(doc) : t('documents.document')}
      back={{ to: '/documents', label: t('documents.title') }}
      actions={
        doc && (
          <Text size="sm" c="dimmed">
            {t('documents.added', { date: formatDay(doc.createdAt) })}
          </Text>
        )
      }
      width={doc && !doc.file ? PAGE_WIDTH.fields : PAGE_WIDTH.withFile}
    >
      <ApiErrorAlert code={error ? errorCode(error) : undefined} />
      {!doc && !error && (
        <Paper p="xl" aria-busy>
          <Skeleton h={320} />
        </Paper>
      )}
      {doc && (
        <DocumentForm
          key={doc.id}
          doc={doc}
          aside={doc.file && <SavedFile id={doc.id} file={doc.file} reading={reading} />}
          top={readable && <ReadPanel doc={doc} outcome={outcome} />}
          lock={reading ? 'reading' : undefined}
          suggestion={suggestion}
          onSave={save}
          onDelete={open}
        />
      )}
      <Modal opened={confirming} onClose={close} title={t('documents.deleteTitle')} centered>
        <Stack gap="md">
          <Text>{t('documents.deleteText')}</Text>
          <ApiErrorAlert code={remove.error} />
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
