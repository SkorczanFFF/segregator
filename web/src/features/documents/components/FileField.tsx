import {
  ActionIcon,
  Button,
  FileButton,
  Flex,
  Indicator,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  useMatches,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import {
  IconCamera,
  IconPhoto,
  IconPlus,
  IconReceipt,
  IconRotate,
  IconRotateClockwise,
  IconUpload,
  IconX,
} from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FILE_MAX_SIZE, FILE_TYPES, isPdf } from 'shared'
import classes from '~/features/documents/components/documents.module.css'
import FilePreview from '~/features/documents/components/FilePreview.tsx'
import { prepareFile, type FileToSend, type PreparedFile } from '~/features/upload/prepare.ts'
import { formatFileSize } from '~/shared/lib/format.ts'

const ACCEPT = FILE_TYPES.join(',')

type FileFieldProps = {
  // Gets what to send, or null when there is nothing to send.
  onChange: (file: FileToSend | null) => void
  // True while a picked file is being prepared, so the page waits with sending.
  onPreparing: (preparing: boolean) => void
  disabled: boolean
}

type FileError = 'fileSize' | 'fileUnreadable'

// Picks the document's file and shows it before sending. A photo can be turned by 90°, so its text is upright.
export default function FileField({ onChange, onPreparing, disabled }: FileFieldProps) {
  const { t } = useTranslation()
  const maxSize = formatFileSize(FILE_MAX_SIZE)
  // On a phone the camera comes first, so picking a file steps back. Read at once, so a computer
  // doesn't show the phone's variant first.
  const chooseVariant = useMatches({ base: 'default', sm: 'filled' }, { getInitialValueInEffect: false })
  const [source, setSource] = useState<File | null>(null)
  const [turns, setTurns] = useState(0)
  const [prepared, setPrepared] = useState<PreparedFile & { image: string }>()
  const [error, setError] = useState<FileError>()
  // Turns and changes wait for the file being prepared, so none of them is lost or applied out of order.
  const [preparing, setPreparing] = useState(false)
  const busy = disabled || preparing
  useEffect(
    () => () => {
      if (prepared) URL.revokeObjectURL(prepared.image)
    },
    [prepared],
  )

  // Every turn starts from the picked file, so a photo is never compressed twice.
  async function prepare(file: File, quarterTurns: number) {
    // A PDF goes as it is, so one that is too big is refused before pdf.js reads it.
    if (isPdf(file.type) && file.size > FILE_MAX_SIZE) return reset('fileSize')
    setPreparing(true)
    onPreparing(true)
    try {
      const result = await prepareFile(file, quarterTurns)
      if (result.file.size > FILE_MAX_SIZE) return reset('fileSize')
      setTurns(quarterTurns)
      setPrepared({ ...result, image: URL.createObjectURL(result.preview) })
      onChange({ file: result.file, hash: result.hash })
    } catch {
      reset('fileUnreadable')
    } finally {
      setPreparing(false)
      onPreparing(false)
    }
  }

  // Empties the field, with the reason when the picked file can't be sent.
  function reset(reason?: FileError) {
    setSource(null)
    setPrepared(undefined)
    setError(reason)
    onChange(null)
  }

  function pick(file: File | null) {
    reset()
    if (!file) return
    setSource(file)
    void prepare(file, 0)
  }

  function rotate(quarterTurns: number) {
    if (source) void prepare(source, (turns + quarterTurns) % 4)
  }

  if (prepared) {
    return (
      <FilePreview file={prepared.file} image={prepared.image} pages={prepared.pages}>
        {!isPdf(prepared.file.type) && (
          <ActionIcon.Group>
            <Tooltip label={t('documents.rotateLeft')}>
              <ActionIcon
                variant="default"
                aria-label={t('documents.rotateLeft')}
                disabled={busy}
                onClick={() => rotate(3)}
              >
                <IconRotate size={18} aria-hidden />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={t('documents.rotateRight')}>
              <ActionIcon
                variant="default"
                aria-label={t('documents.rotateRight')}
                disabled={busy}
                onClick={() => rotate(1)}
              >
                <IconRotateClockwise size={18} aria-hidden />
              </ActionIcon>
            </Tooltip>
          </ActionIcon.Group>
        )}
        <FileButton onChange={pick} accept={ACCEPT} disabled={busy}>
          {(props) => (
            <Button variant="subtle" size="compact-md" disabled={busy} {...props}>
              {t('documents.changeFile')}
            </Button>
          )}
        </FileButton>
        <Tooltip label={t('documents.removeFile')}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t('documents.removeFile')}
            disabled={busy}
            onClick={() => pick(null)}
          >
            <IconX size={18} aria-hidden />
          </ActionIcon>
        </Tooltip>
      </FilePreview>
    )
  }

  return (
    <Dropzone
      onDrop={(files) => pick(files[0] ?? null)}
      onReject={() => reset('fileUnreadable')}
      accept={[...FILE_TYPES]}
      multiple={false}
      activateOnClick={false}
      activateOnKeyboard={false}
      enablePointerEvents
      loading={source !== null}
      disabled={disabled}
      radius="md"
      p="xl"
      className={classes.ground}
      classNames={{ root: classes.dropzone, inner: classes.dropzoneInner }}
    >
      <IconReceipt size={260} stroke={0.75} className={classes.watermark} aria-hidden />
      <Indicator size={28} offset={6} withBorder label={<IconPlus size={16} stroke={3} aria-hidden />}>
        <ThemeIcon size={88} radius="xl" variant="light">
          <IconPhoto size={44} stroke={1.5} aria-hidden />
        </ThemeIcon>
      </Indicator>
      <div>
        <Title order={2} size="h3" visibleFrom="sm" mb={6}>
          {t('documents.dropTitle')}
        </Title>
        <Text c="dimmed" maw={380}>
          {t('documents.dropText')}
        </Text>
      </div>
      <Flex direction={{ base: 'column', sm: 'row' }} gap="sm" w={{ base: '100%', sm: 'auto' }}>
        <FileButton onChange={pick} accept="image/*" capture="environment" disabled={disabled}>
          {(props) => (
            <Button hiddenFrom="sm" variant="filled" leftSection={<IconCamera size={18} aria-hidden />} disabled={disabled} {...props}>
              {t('documents.takePhoto')}
            </Button>
          )}
        </FileButton>
        <FileButton onChange={pick} accept={ACCEPT} disabled={disabled}>
          {(props) => (
            <Button variant={chooseVariant} leftSection={<IconUpload size={18} aria-hidden />} disabled={disabled} {...props}>
              {t('documents.chooseFile')}
            </Button>
          )}
        </FileButton>
      </Flex>
      <Text size="sm" c="dimmed">
        {t('documents.dropHint', { maxSize })}
      </Text>
      {error && (
        <Text size="sm" c="var(--mantine-color-error)" role="alert">
          {t(`documents.errors.${error}`, { maxSize })}
        </Text>
      )}
    </Dropzone>
  )
}
