import { TextInput, type TextInputProps } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { EMAIL_PROPS } from '~/features/auth/email.ts'

export default function EmailField(props: TextInputProps) {
  const { t } = useTranslation()
  return <TextInput label={t('common.email')} {...EMAIL_PROPS} {...props} />
}
