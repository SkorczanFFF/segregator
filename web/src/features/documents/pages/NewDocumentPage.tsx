import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { DocumentInput } from 'shared'
import DocumentForm, { PAGE_WIDTH_WITH_FILE } from '~/features/documents/components/DocumentForm.tsx'
import { refreshDocuments } from '~/features/documents/useDocuments.ts'
import { uploadDocument, type OnProgress } from '~/features/upload/upload.ts'
import Page from '~/shared/components/Page.tsx'
import { api } from '~/shared/lib/api.ts'

export default function NewDocumentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function create(input: DocumentInput, file: Blob | null, onProgress: OnProgress) {
    if (file) await uploadDocument(input, file, onProgress)
    else await api.post('/documents', input)
    await refreshDocuments(queryClient)
    navigate('/documents')
  }

  return (
    <Page
      title={t('documents.new')}
      back={{ to: '/documents', label: t('documents.title') }}
      width={PAGE_WIDTH_WITH_FILE}
    >
      <DocumentForm onSave={create} />
    </Page>
  )
}
