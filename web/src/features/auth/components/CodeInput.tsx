import { Input, PinInput, type PinInputProps } from '@mantine/core'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CODE_LENGTH } from 'shared'

type CodeInputProps = Omit<PinInputProps, 'error'> & { error?: ReactNode }

// The code from the email, one box per digit. A phone can fill it in from the message.
export default function CodeInput({ error, ...props }: CodeInputProps) {
  const { t } = useTranslation()
  return (
    <Input.Wrapper label={t('common.code')} error={error}>
      <PinInput
        length={CODE_LENGTH}
        type="number"
        size="lg"
        gap="sm"
        mt={6}
        oneTimeCode
        ariaLabel={t('common.code')}
        {...props}
        error={Boolean(error)}
      />
    </Input.Wrapper>
  )
}
