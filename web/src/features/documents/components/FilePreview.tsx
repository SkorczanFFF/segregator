import { Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconFileText } from '@tabler/icons-react'
import { useState, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import classes from '~/features/documents/components/file.module.css'
import { fileFormat, formatFileSize } from '~/shared/lib/format.ts'

// How much the loupe enlarges the image as shown.
const ZOOM = 2

type FilePreviewProps = {
  file: { type: string; size: number }
  // The first page as an image. Without it an icon stands in its place.
  image?: string
  pages?: number
  // Placed in the bar under the image, e.g. buttons or a link to the file.
  children?: ReactNode
}

type Pointer = { x: number; y: number; box: DOMRect }

// The document's file, before sending and after it. With a mouse, a loupe follows the cursor over the image.
export default function FilePreview({ file, image, pages = 1, children }: FilePreviewProps) {
  const { t } = useTranslation()
  const [pointer, setPointer] = useState<Pointer>()

  function follow(event: PointerEvent<HTMLImageElement>) {
    if (event.pointerType !== 'mouse') return
    setPointer({ x: event.clientX, y: event.clientY, box: event.currentTarget.getBoundingClientRect() })
  }

  return (
    <Paper className={classes.card}>
      <div className={`${classes.ground} ${classes.stage}`}>
        <div className={classes.fit}>
          {image ? (
            <img
              className={classes.image}
              src={image}
              alt={t('documents.preview')}
              onPointerMove={follow}
              onPointerLeave={() => setPointer(undefined)}
            />
          ) : (
            <ThemeIcon size={88} radius="xl" variant="light">
              <IconFileText size={44} stroke={1.5} />
            </ThemeIcon>
          )}
        </div>
      </div>
      <Group justify="space-between" gap="xs" px="md" py="xs" className={classes.bar}>
        <Stack gap={0}>
          <Text size="sm" c="dimmed">
            {t('documents.file', { format: fileFormat(file.type), size: formatFileSize(file.size) })}
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
    </Paper>
  )
}
