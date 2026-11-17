import { Anchor, Button, Stack } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isPdf, type Document, type DocumentFile, type FileVersion } from 'shared'
import FilePreview from '~/features/documents/components/FilePreview.tsx'
import VersionSwitch from '~/features/documents/components/VersionSwitch.tsx'
import { documentKey, fileUrl } from '~/features/documents/useDocuments.ts'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'
import { api } from '~/shared/lib/api.ts'

// A saved document's file. A photo shows on the page, a PDF opens in a new tab. A photo that processing
// changed shows either version, and the one in use can be swapped.
export default function SavedFile({ id, file }: { id: string; file: DocumentFile }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const used = file.use ?? 'processed'
  const [shown, setShown] = useState<FileVersion>(file.change ? used : 'raw')
  const use = useApiSubmit(async () => {
    queryClient.setQueryData(documentKey(id), await api.put<Document>(`/documents/${id}/file`, { use: shown }))
  })
  const url = fileUrl(id, shown)

  return (
    <Stack gap="md">
      <FilePreview
        file={file}
        image={isPdf(file.type) ? undefined : url}
        pages={file.pages}
        header={file.change && <VersionSwitch value={shown} onChange={setShown} />}
        caption={file.change && t(shown === used ? 'documents.inUse' : 'documents.notInUse')}
      >
        {file.change && shown !== used && (
          <Button variant="default" size="compact-md" loading={use.pending} onClick={() => void use.submit(undefined)}>
            {t('documents.useThis')}
          </Button>
        )}
        <Anchor href={url} target="_blank" rel="noopener" size="sm" fw={600}>
          {t('documents.openFile')}
        </Anchor>
      </FilePreview>
      {use.error && <StatusAlert status="error">{t(`errors.${use.error}`)}</StatusAlert>}
    </Stack>
  )
}
