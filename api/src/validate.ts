import { validator } from 'hono/validator'
import type * as z from 'zod'
import { apiError } from './errors.ts'

// Lets a route run only with a JSON body that matches the schema. Anything else gets 400.
export const jsonBody = <T extends z.ZodType>(schema: T) =>
  validator('json', (value, c) => {
    const result = schema.safeParse(value)
    return result.success ? (result.data as z.output<T>) : apiError(c, 'invalid_input', 400)
  })
