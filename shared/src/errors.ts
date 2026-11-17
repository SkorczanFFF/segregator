// Error codes the API answers with. The web app has a message for each one.
export const ERROR_CODES = [
  'invalid_input',
  'invalid_credentials',
  'not_confirmed',
  'invalid_code',
  'code_expired',
  'weak_password',
  'signup_closed',
  'google_failed',
  'too_many_requests',
  'unauthorized',
  'forbidden',
  'not_found',
  'duplicate',
  'storage_full',
  'internal_error',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]
