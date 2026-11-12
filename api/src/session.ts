import { createHash, randomBytes } from 'node:crypto'
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

export type Session = { sub: string; email: string }
export type Env = { Variables: { session: Session } }

const db = new DynamoDBClient({})
const TABLE = process.env.TABLE_NAME
const COOKIE = 'session'
const DAY = 24 * 60 * 60
const IDLE_LIMIT = 7 * DAY
const ABSOLUTE_LIMIT = 30 * DAY

const now = () => Math.floor(Date.now() / 1000)

// The table keeps only a hash, so a leaked table can't be turned into working cookies.
const key = (id: string) => ({
  PK: { S: `SESSION#${createHash('sha256').update(id).digest('base64url')}` },
  SK: { S: 'SESSION' },
})

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
        // Also the TTL attribute, so DynamoDB removes expired sessions for free.
        expiresAt: { N: String(createdAt + IDLE_LIMIT) },
      },
    }),
  )
  setCookie(c, COOKIE, id, {
    prefix: 'host',
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: ABSOLUTE_LIMIT,
  })
}

export async function readSession(c: Context): Promise<Session | undefined> {
  const id = getCookie(c, COOKIE, 'host')
  if (!id || id.length > 64) return undefined

  const { Item } = await db.send(
    new GetItemCommand({ TableName: TABLE, Key: key(id), ConsistentRead: true }),
  )
  // TTL deletes items up to a few days late, so expiry is checked here too.
  const expiresAt = Number(Item?.expiresAt?.N)
  const sub = Item?.sub?.S
  const email = Item?.email?.S
  const time = now()
  if (!sub || !email || !(expiresAt > time)) return undefined

  // Extend the idle limit at most once a day, which saves a write on most requests.
  if (expiresAt - time < IDLE_LIMIT - DAY) {
    const extended = Math.min(Number(Item?.createdAt?.N) + ABSOLUTE_LIMIT, time + IDLE_LIMIT)
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: key(id),
        UpdateExpression: 'SET expiresAt = :expiresAt',
        ExpressionAttributeValues: { ':expiresAt': { N: String(extended) } },
      }),
    )
  }
  return { sub, email }
}

export async function deleteSession(c: Context) {
  const id = getCookie(c, COOKIE, 'host')
  if (id && id.length <= 64) {
    await db.send(new DeleteItemCommand({ TableName: TABLE, Key: key(id) }))
  }
  deleteCookie(c, COOKIE, { prefix: 'host', httpOnly: true, sameSite: 'Strict' })
}
