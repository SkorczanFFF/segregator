import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import StatusAlert from '~/shared/components/StatusAlert.tsx'
import type { ApiErrorCode } from '~/shared/lib/api.ts'

type ApiErrorAlertProps = Omit<ComponentProps<typeof StatusAlert>, 'status' | 'children'> & { code?: ApiErrorCode }

// The message for an API error, or nothing without one.
export default function ApiErrorAlert({ code, ...props }: ApiErrorAlertProps) {
  const { t } = useTranslation()
  return code ? (
    <StatusAlert status="error" {...props}>
      {t(`errors.${code}`)}
    </StatusAlert>
  ) : null
}
