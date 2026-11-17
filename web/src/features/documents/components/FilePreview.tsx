import { Box, Center, Group, Paper, Skeleton, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconFileText } from '@tabler/icons-react'
import { useState, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import classes from '~/features/documents/components/documents.module.css'
import ImageViewer from '~/features/documents/components/ImageViewer.tsx'
import { fileFormat, formatFileSize } from '~/shared/lib/format.ts'

// How much the loupe enlarges the image as shown.
const ZOOM = 2

type FilePreviewProps = {
  file: { type: string; size: number }
  // The first page as an image. Without it an icon stands in its place.
  image?: string
  pages?: number
  // Above the image, e.g. a switch between versions of the file. The viewer shows it too.
  header?: ReactNode
  // In place of the file's format and size, e.g. which version is shown.
  caption?: ReactNode
  // Placed in the bar under the image, e.g. buttons or a link to the file.
  children?: ReactNode
  // While the file is worked on: the image dims under a label of what happens, and with scan a band of light
  // sweeps down it.
  busy?: { label: string; scan?: boolean }
}

type Pointer = { x: number; y: number; box: DOMRect }

// The document's file, before sending and after it. With a mouse, a loupe follows the cursor over the image,
// and a click or a tap opens it in a viewer.
export default function FilePreview({ file, image, pages = 1, header, caption, children, busy }: FilePreviewProps) {
  const { t } = useTranslation()
  const [pointer, setPointer] = useState<Pointer>()
  const [viewing, viewer] = useDisclosure()
  // The image shown last, so a placeholder stands in until a new one has loaded, e.g. another version.
  const [loaded, setLoaded] = useState<string>()
  const waiting = image !== undefined && loaded !== image

  function follow(event: PointerEvent<HTMLImageElement>) {
    if (event.pointerType !== 'mouse' || busy) return
    setPointer({ x: event.clientX, y: event.clientY, box: event.currentTarget.getBoundingClientRect() })
  }

  return (
    // Grows to the height of its column, so the image gets the room the fields beside it take.
    <Paper className={classes.card} flex={1}>
      {header && (
        <Box p={6} className={classes.top}>
          {header}
        </Box>
      )}
      <Box className={classes.ground} flex={1}>
        <div className={classes.fit}>
          {image ? (
            <UnstyledButton className={classes.zoom} aria-label={t('documents.zoom')} onClick={viewer.open} disabled={Boolean(busy)}>
              <img
                className={classes.image}
                style={{ opacity: waiting ? 0 : busy ? 0.7 : undefined }}
                src={image}
                alt={t('documents.preview')}
                // A cached image may be complete before React listens for its load.
                ref={(node) => {
                  if (node?.complete && waiting) setLoaded(image)
                }}
                onLoad={() => setLoaded(image)}
                onError={() => setLoaded(image)}
                onPointerMove={follow}
                onPointerLeave={() => setPointer(undefined)}
              />
            </UnstyledButton>
          ) : (
            <ThemeIcon size={88} radius="xl" variant="light">
              <IconFileText size={44} stroke={1.5} aria-hidden />
            </ThemeIcon>
          )}
          {waiting && (
            <Center pos="absolute" inset={0} aria-hidden>
              <Skeleton h="100%" w="auto" maw="100%" radius="sm" style={{ aspectRatio: '3 / 4' }} />
            </Center>
          )}
        </div>
        {busy?.scan && <div className={classes.scan} aria-hidden />}
        {busy && (
          <Text size="sm" fw={600} className={classes.busy} aria-hidden>
            {busy.label}
          </Text>
        )}
      </Box>
      <Group justify="space-between" gap="xs" px="md" py="xs" className={classes.bar}>
        <Stack gap={0}>
          <Text size="sm" c="dimmed">
            {caption ?? t('documents.file', { format: fileFormat(file.type), size: formatFileSize(file.size) })}
          </Text>
          {pages > 1 && (
            <Text size="sm" c="dimmed">
              {t('documents.pages', { pages })}
            </Text>
          )}
        </Stack>
        <Group gap={4}>{children}</Group>
      </Group>
      {image && pointer && (
        <div className={classes.loupe} style={{ left: pointer.x, top: pointer.y }} aria-hidden>
          <img
            src={image}
            alt=""
            style={{
              width: pointer.box.width * ZOOM,
              left: `calc(50% - ${(pointer.x - pointer.box.left) * ZOOM}px)`,
              top: `calc(50% - ${(pointer.y - pointer.box.top) * ZOOM}px)`,
            }}
          />
        </div>
      )}
      {image && <ImageViewer image={image} opened={viewing} onClose={viewer.close} header={header} />}
    </Paper>
  )
}
