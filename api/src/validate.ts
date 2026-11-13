import type { Context } from 'hono'
import type * as z from 'zod'

// Reads the JSON body and returns it only when it matches the schema.
export async function parse<T extends z.ZodType>(c: Context, schema: T) {
  const result = schema.safeParse(await c.req.json().catch(() => undefined))
  return result.success ? result.data : undefined
}
