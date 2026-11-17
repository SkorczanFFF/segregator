import { Badge } from '@mantine/core'
import { IconSparkles } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// Marks a field the model filled in, until the person changes it.
export default function AiMark() {
  const { t } = useTranslation()
  return (
    <Badge
      component="span"
      size="sm"
      radius="sm"
      variant="light"
      color="saffron"
      tt="none"
      ml={8}
      leftSection={<IconSparkles size={12} aria-hidden />}
    >
      {t('documents.read.mark')}
    </Badge>
  )
}
