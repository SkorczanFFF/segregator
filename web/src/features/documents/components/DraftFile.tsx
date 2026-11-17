import { Button, Group, Image, Paper, SimpleGrid, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconCheck, IconFileText } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isPdf, needsChoice, usedVersion, type DocumentFile, type Draft, type FileChange, type FileVersion } from 'shared'
import FilePreview from '~/features/documents/components/FilePreview.tsx'
import ImageViewer from '~/features/documents/components/ImageViewer.tsx'
import VersionSwitch from '~/features/documents/components/VersionSwitch.tsx'
import { chooseVersion, fileUrl } from '~/features/documents/useDocuments.ts'
import ApiErrorAlert from '~/shared/components/ApiErrorAlert.tsx'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import { useApiSubmit } from '~/shared/hooks/useApiSubmit.ts'

type DraftFileProps = {
  draft: Draft
  // Drops this draft, so another photo can be picked.
  onOtherPhoto: () => void
}

// The file of a draft once it is no longer on its way: a problem, the versions to compare, or the chosen one.
export default function DraftFile({ draft, onOtherPhoto }: DraftFileProps) {
  const { t } = useTranslation()
  const [choosing, setChoosing] = useState(false)
  const { file } = draft

  if (draft.status === 'uploading') {
    return <Problem status="warning" text={t('documents.interrupted')} action={t('documents.choosePhoto')} onAction={onOtherPhoto} />
  }
  if (draft.status === 'failed' || !file) {
    return <Problem status="error" text={t('documents.fileFailed')} action={t('documents.otherPhoto')} onAction={onOtherPhoto} />
  }
  if (file.change && (needsChoice(file) || choosing)) {
    return (
      <Comparison id={draft.id} file={file} change={file.change} onChosen={() => setChoosing(false)} onOtherPhoto={onOtherPhoto} />
    )
  }
  return <Chosen id={draft.id} file={file} onChange={file.change && (() => setChoosing(true))} />
}

function Problem({ status, text, action, onAction }: { status: 'warning' | 'error'; text: string; action: string; onAction: () => void }) {
  return (
    <Stack gap="md">
      <StatusAlert status={status}>{text}</StatusAlert>
      <Button onClick={onAction}>
        {action}
      </Button>
    </Stack>
  )
}

type ComparisonProps = {
  id: string
  file: DocumentFile
  change: FileChange
  onChosen: () => void
  onOtherPhoto: () => void
}

// One version at a time, large enough to see whether anything was cut off, with the three ways on.
function Comparison({ id, file, change, onChosen, onOtherPhoto }: ComparisonProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [shown, setShown] = useState<FileVersion>('processed')
  const choose = useApiSubmit(async (use: FileVersion) => {
    await chooseVersion(queryClient, id, use)
    onChosen()
  })

  return (
    <Stack gap="md" flex={1}>
      <FilePreview
        file={file}
        image={fileUrl(id, shown)}
        header={<VersionSwitch value={shown} onChange={setShown} />}
        caption={t(`documents.changes.${change}`)}
      />
      <ApiErrorAlert code={choose.error} />
      <Button
        leftSection={<IconCheck size={18} aria-hidden />}
        loading={choose.pending}
        onClick={() => void choose.submit('processed')}
      >
        {t('documents.approve')}
      </Button>
      <SimpleGrid cols={2} spacing="sm">
        <Button variant="default" disabled={choose.pending} onClick={() => void choose.submit('raw')}>
          {t('documents.useOriginal')}
        </Button>
        <Button variant="subtle" disabled={choose.pending} onClick={onOtherPhoto}>
          {t('documents.otherPhoto')}
        </Button>
      </SimpleGrid>
    </Stack>
  )
}

// The version the fields go with. A wide screen shows it whole beside the fields; a phone, a small row
// above them, whose image opens in the viewer.
function Chosen({ id, file, onChange }: { id: string; file: DocumentFile; onChange?: () => void }) {
  const { t } = useTranslation()
  const [viewing, viewer] = useDisclosure()
  const pdf = isPdf(file.type)
  const version = usedVersion(file)
  const image = pdf ? undefined : fileUrl(id, version)
  const state = file.change ? version : pdf ? 'pdf' : 'unchanged'
  const title = t(`documents.chosen.${state}.title`)
  const status = t(`documents.chosen.${state}.status`)
  const change = onChange && (
    <Button variant="subtle" size="compact-md" onClick={onChange}>
      {t('documents.changeChoice')}
    </Button>
  )

  return (
    <>
      <Stack visibleFrom="md" flex={1}>
        <FilePreview file={file} image={image} pages={file.pages} caption={`${title} · ${status}`}>
          {change}
        </FilePreview>
      </Stack>
      <Paper hiddenFrom="md" p="sm">
        <Group gap="sm" wrap="nowrap">
          {image ? (
            <UnstyledButton aria-label={t('documents.zoom')} onClick={viewer.open} flex="none">
              <Image src={image} alt={t('documents.preview')} w={54} h={72} radius="sm" fit="cover" />
            </UnstyledButton>
          ) : (
            <ThemeIcon size={54} radius="md" variant="light">
              <IconFileText size={28} stroke={1.5} aria-hidden />
            </ThemeIcon>
          )}
          <Stack gap={2} flex={1} miw={0}>
            <Text fw={600}>{title}</Text>
            <Group gap={6} wrap="nowrap">
              <IconCheck size={16} stroke={2.5} color="var(--mantine-color-saffron-filled)" aria-hidden />
              <Text size="sm" c="dimmed">
                {status}
              </Text>
            </Group>
          </Stack>
          {change}
        </Group>
      </Paper>
      {image && <ImageViewer image={image} opened={viewing} onClose={viewer.close} />}
    </>
  )
}
