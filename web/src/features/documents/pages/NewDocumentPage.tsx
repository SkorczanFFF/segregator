import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { DocumentInput } from 'shared'
import DocumentForm from '~/features/documents/components/DocumentForm.tsx'
import { refreshDocuments } from '~/features/documents/useDocuments.ts'
import Page from '~/shared/components/Page.tsx'
import { api } from '~/shared/lib/api.ts'

export default function NewDocumentPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  async function create(input: DocumentInput) {
    await api.post('/documents', input)
    await refreshDocuments(queryClient)
    navigate('/documents')
  }

  return (
    <Page title={t('documents.new')} width={560}>
      <DocumentForm onSave={create} />
    </Page>
  )
}
