import type { ParseKeys } from 'i18next'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

// Form errors hold translation keys, so messages follow the language.
export function useFormError(values?: Record<string, unknown>) {
  const { t } = useTranslation()
  return (error: ReactNode) =>
    error ? t(String(error) as ParseKeys, values ?? {}) : undefined
}
