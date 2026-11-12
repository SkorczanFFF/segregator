// Error codes the API returns. Their messages live under `errors` in the translations.
export const API_ERRORS = [
  'invalid_input',
  'invalid_credentials',
  'not_confirmed',
  'invalid_code',
  'code_expired',
  'weak_password',
  'too_many_requests',
  'unauthorized',
  'not_found',
  'internal_error',
  'network_error',
] as const

export type ApiErrorCode = (typeof API_ERRORS)[number]

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode) {
    super(code)
    this.code = code
  }
}

const isApiErrorCode = (value: unknown): value is ApiErrorCode =>
  API_ERRORS.includes(value as ApiErrorCode)

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('network_error')
  }

  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => undefined)
  if (response.ok && data !== undefined) return data as T

  const code = (data as { error?: unknown } | undefined)?.error
  throw new ApiError(isApiErrorCode(code) ? code : 'internal_error')
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T = void>(path: string, body?: unknown) => request<T>('POST', path, body),
}
