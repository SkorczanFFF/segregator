import { createHash, randomBytes } from 'node:crypto'
import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { TTL_ATTRIBUTE } from 'shared'
import { DAY, TABLE, db, deleteItems, ifConditionMet, now } from './table.ts'

export type Session = { sub: string; email: string; demo?: boolean }
export type Env = { Variables: { session: Session } }

// The made-up account the demo shows. Cognito's subs are UUIDs, so no real account shares its keys.
export const DEMO: Session = { sub: 'demo', email: 'demo@example.com', demo: true }

const COOKIE = 'session'
const COOKIE_OPTIONS = { prefix: 'host', httpOnly: true, sameSite: 'Strict' } as const
const IDLE_LIMIT = 7 * DAY
const ABSOLUTE_LIMIT = 30 * DAY

// The table keeps only a hash, so a leaked table can't be turned into working cookies.
const key = (id: string) => ({
  PK: { S: `SESSION#${createHash('sha256').update(id).digest('base64url')}` },
  SK: { S: 'SESSION' },
})

// Index key that lists one user's sessions, so all of them can be ended at once.
const userSessions = (sub: string) => ({ S: `USER#${sub}#SESSIONS` })

// The cookie's value when it can be a session id at all. A real one has 43 characters.
function sessionId(c: Context) {
  const id = getCookie(c, COOKIE, 'host')
  return id && id.length <= 64 ? id : undefined
}

export async function createSession(c: Context, session: Session) {
  const id = randomBytes(32).toString('base64url')
  const createdAt = now()
  await db.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        ...key(id),
        sub: { S: session.sub },
        email: { S: session.email },
        createdAt: { N: String(createdAt) },
        GSI1PK: userSessions(session.sub),
        GSI1SK: { S: String(createdAt) },
        ...(session.demo ? { demo: { BOOL: true } } : {}),
        [TTL_ATTRIBUTE]: { N: String(createdAt + IDLE_LIMIT) },
      },
    }),
  )
  setCookie(c, COOKIE, id, { ...COOKIE_OPTIONS, maxAge: ABSOLUTE_LIMIT })
}

export async function readSession(c: Context): Promise<Session | undefined> {
  const id = sessionId(c)
  if (!id) return undefined

  const { Item } = await db.send(
    new GetItemCommand({ TableName: TABLE, Key: key(id), ConsistentRead: true }),
  )
  // TTL deletes items up to a few days late, so expiry is checked here too.
  const expiresAt = Number(Item?.[TTL_ATTRIBUTE]?.N)
  const sub = Item?.sub?.S
  const email = Item?.email?.S
  const time = now()
  if (!sub || !email || !(expiresAt > time)) return undefined

  // The idle limit is extended at most once a day. A session ended meanwhile, by signing out or a new password,
  // stays ended.
  if (expiresAt - time < IDLE_LIMIT - DAY) {
    const extended = Math.min(Number(Item?.createdAt?.N) + ABSOLUTE_LIMIT, time + IDLE_LIMIT)
    const updated = await ifConditionMet(
      db.send(
        new UpdateItemCommand({
          TableName: TABLE,
          Key: key(id),
          UpdateExpression: 'SET #ttl = :expiresAt',
          ConditionExpression: 'attribute_exists(PK)',
          ExpressionAttributeNames: { '#ttl': TTL_ATTRIBUTE },
          ExpressionAttributeValues: { ':expiresAt': { N: String(extended) } },
        }),
      ),
    )
    if (!updated) return undefined
  }
  return { sub, email, ...(Item?.demo?.BOOL ? { demo: true } : {}) }
}

export async function deleteSession(c: Context) {
  const id = sessionId(c)
  if (id) await db.send(new DeleteItemCommand({ TableName: TABLE, Key: key(id) }))
  deleteCookie(c, COOKIE, COOKIE_OPTIONS)
}

export async function deleteAllSessions(sub: string) {
  let startKey: Record<string, AttributeValue> | undefined
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': userSessions(sub) },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey: startKey,
      }),
    )
    await deleteItems(page.Items ?? [])
    startKey = page.LastEvaluatedKey
  } while (startKey)
}
