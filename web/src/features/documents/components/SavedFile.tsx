import { Anchor, Button, Stack } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isPdf, usedVersion, type DocumentFile, type FileVersion } from 'shared'
import FilePreview from '~/features/documents/components/FilePreview.tsx'
import VersionSwitch from '~/features/documents/components/VersionSwitch.tsx'
import { readingBusy } from '~/features/documents/look.ts'
import { chooseVersion, fileUrl } from '~/features/documents/useDocuments.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'

// A saved document's file. A photo shows on the page, a PDF opens in a new tab. A photo that processing
// changed shows either version, and the one in use can be swapped. While the model reads it, it says so.
export default function SavedFile({ id, file, reading }: { id: string; file: DocumentFile; reading: boolean }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const used = usedVersion(file)
  const [shown, setShown] = useState<FileVersion>(used)
  const keep = useApiSubmit(() => chooseVersion(queryClient, id, shown))
  const url = fileUrl(id, shown)

  return (
    <Stack gap="md">
      <FilePreview
        busy={reading ? readingBusy(t) : undefined}
        file={file}
        image={isPdf(file.type) ? undefined : url}
        pages={file.pages}
        header={file.change && <VersionSwitch value={shown} onChange={setShown} />}
        caption={file.change && t(shown === used ? 'documents.inUse' : 'documents.notInUse')}
      >
        {file.change && shown !== used && (
          <Button variant="default" size="compact-md" loading={keep.pending} onClick={() => void keep.submit(undefined)}>
            {t('documents.useThis')}
          </Button>
        )}
        <Anchor href={url} target="_blank" rel="noopener" size="sm" fw={600}>
          {t('documents.openFile')}
        </Anchor>
      </FilePreview>
      <ApiErrorAlert code={keep.error} />
    </Stack>
  )
}
