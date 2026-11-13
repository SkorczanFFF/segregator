import { useState } from 'react'
import { errorCode, type ApiErrorCode } from '~/shared/lib/api.ts'

// Runs a form action and keeps its pending state and API error for the form.
export function useApiSubmit<T>(action: (values: T) => Promise<void>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiErrorCode>()

  async function submit(values: T) {
    setPending(true)
    setError(undefined)
    try {
      await action(values)
    } catch (err) {
      setError(errorCode(err))
    } finally {
      setPending(false)
    }
  }

  return { submit, pending, error }
}
