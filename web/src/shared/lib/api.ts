import { ERROR_CODES, type ErrorCode } from 'shared'

// The API's codes, plus network_error when it can't be reached. Their messages live under `errors` in the translations.
export type ApiErrorCode = ErrorCode | 'network_error'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  // The document the error is about, e.g. the one that already has a duplicate file.
  readonly id?: string

  constructor(code: ApiErrorCode, id?: string) {
    super(code)
    this.code = code
    this.id = id
  }
}

export const errorCode = (err: unknown): ApiErrorCode => (err instanceof ApiError ? err.code : 'internal_error')

export const isErrorCode = (value: unknown): value is ErrorCode => ERROR_CODES.includes(value as ErrorCode)

// Where CloudFront, or Vite's proxy, sends requests on to the API.
export const API_BASE = '/api'

// Called when the API no longer knows the session, e.g. it expired or ended on another device.
let sessionEnded = () => {}
export const onSessionEnded = (handler: () => void) => {
  sessionEnded = handler
}

async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('network_error')
  }

  // API Gateway's own throttling answers 429 without our error body.
  if (response.status === 429) throw new ApiError('too_many_requests')
  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => undefined)
  if (response.ok && data !== undefined) return data as T

  const { error: code, id } = (data ?? {}) as { error?: unknown; id?: unknown }
  if (code === 'unauthorized') sessionEnded()
  throw new ApiError(isErrorCode(code) ? code : 'internal_error', typeof id === 'string' ? id : undefined)
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T = void>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: (path: string, body?: unknown) => request<void>('DELETE', path, body),
}
