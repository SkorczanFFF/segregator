import { SegmentedControl } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { FileVersion } from 'shared'

// The processed copy comes first, since it is the one to check.
const ORDER: FileVersion[] = ['processed', 'raw']

// Switches the preview between the version after processing and the photo as it was sent.
export default function VersionSwitch({ value, onChange }: { value: FileVersion; onChange: (version: FileVersion) => void }) {
  const { t } = useTranslation()
  return (
    <SegmentedControl
      fullWidth
      value={value}
      onChange={(version) => onChange(version as FileVersion)}
      data={ORDER.map((version) => ({ value: version, label: t(`documents.versions.${version}`) }))}
      aria-label={t('documents.versions.title')}
    />
  )
}
