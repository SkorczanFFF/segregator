import { Input, PinInput, Stack, type PinInputProps } from '@mantine/core'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CODE_LENGTH } from 'shared'

type CodeInputProps = Omit<PinInputProps, 'error'> & { error?: ReactNode }

// The code from the email, one box per digit. A phone can fill it in from the message. Input.Wrapper
// would give every box the same id, so the label and the error belong to the group of boxes instead.
export default function CodeInput({ error, ...props }: CodeInputProps) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <Stack gap={6}>
      <Input.Label id={`${id}-label`} labelElement="div">
        {t('common.code')}
      </Input.Label>
      <PinInput
        length={CODE_LENGTH}
        type="number"
        size="lg"
        gap="sm"
        oneTimeCode
        ariaLabel={t('common.code')}
        aria-labelledby={`${id}-label`}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
        error={Boolean(error)}
      />
      {error && <Input.Error id={`${id}-error`}>{error}</Input.Error>}
    </Stack>
  )
}
