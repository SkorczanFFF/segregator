import { Stepper } from '@mantine/core'
import { useTranslation } from 'react-i18next'

// Where a new document is: its file, the file's processing, then its fields.
export default function DocumentSteps({ active }: { active: 0 | 1 | 2 }) {
  const { t } = useTranslation()
  return (
    <Stepper active={active} size="sm" color="saffron" maw={480}>
      <Stepper.Step label={t('documents.steps.file')} />
      <Stepper.Step label={t('documents.steps.processing')} />
      <Stepper.Step label={t('documents.steps.fields')} />
    </Stepper>
  )
}
