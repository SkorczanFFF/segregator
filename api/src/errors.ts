import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ErrorCode } from 'shared'

// Every error answer goes through here, so the API sends only codes the web app can show.
export const apiError = (c: Context, code: ErrorCode, status: ContentfulStatusCode) => c.json({ error: code }, status)

// The file is already in the account, and id is the document that has it.
export const duplicateError = (c: Context, id: string) => c.json({ error: 'duplicate' satisfies ErrorCode, id }, 409)
