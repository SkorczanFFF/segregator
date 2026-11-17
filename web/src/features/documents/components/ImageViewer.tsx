import { Image, Modal, Stack, useMatches } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type ImageViewerProps = {
  image: string
  opened: boolean
  onClose: () => void
  // Above the image, e.g. the same switch between versions as on the page.
  header?: ReactNode
}

// The image as wide as the screen allows, scrolled for a long receipt. On a phone it takes the whole screen,
// where two fingers zoom in further.
export default function ImageViewer({ image, opened, onClose, header }: ImageViewerProps) {
  const { t } = useTranslation()
  // Where the rest of the document's page switches to its phone layout.
  const phone = useMatches({ base: true, md: false })
  return (
    <Modal opened={opened} onClose={onClose} title={t('documents.preview')} size="xl" fullScreen={phone} centered>
      <Stack gap="sm">
        {header}
        <Image src={image} alt={t('documents.preview')} radius="sm" />
      </Stack>
    </Modal>
  )
}
