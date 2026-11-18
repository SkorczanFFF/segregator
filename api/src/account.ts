import { Hono } from 'hono'
import { DeleteAccountInput } from 'shared'
import { deleteUser } from './cognito.ts'
import { deleteAccountFiles } from './document-files.ts'
import { deleteAccountItems } from './document-table.ts'
import { apiError } from './errors.ts'
import { deleteAllSessions, deleteSession, type Env } from './session.ts'
import { jsonBody } from './validate.ts'

export const account = new Hono<Env>()

// Deletes the account with everything it holds, once its address is typed again. The user goes after the data and
// the sessions go last, so a failure on the way leaves an account that can still sign in and try again.
account.delete('/', jsonBody(DeleteAccountInput), async (c) => {
  const { sub, email } = c.get('session')
  if (c.req.valid('json').email !== email.toLowerCase()) return apiError(c, 'email_mismatch', 400)
  await deleteAccountFiles(sub)
  await deleteAccountItems(sub)
  await deleteUser(sub)
  await deleteAllSessions(sub)
  await deleteSession(c)
  return c.body(null, 204)
})
