import { Modal, Stack } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import classes from '~/features/documents/components/documents.module.css'

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
  const phone = useMediaQuery('(max-width: 48em)')
  return (
    <Modal opened={opened} onClose={onClose} title={t('documents.preview')} size="xl" fullScreen={phone} centered>
      <Stack gap="sm">
        {header}
        <img className={classes.whole} src={image} alt={t('documents.preview')} />
      </Stack>
    </Modal>
  )
}
