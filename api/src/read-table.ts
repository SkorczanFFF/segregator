import {
  GetItemCommand,
  TransactionCanceledException,
  TransactWriteItemsCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { ReadResult, ReadUse } from 'shared'
import { ulid } from 'ulid'
import { accountKey, docKey, LIVE, live, status } from './document-keys.ts'
import type { ReadLimits } from './read-limits.ts'
import { TABLE, db, ifConditionMet, now, type Item } from './table.ts'

// A reading still under way after this long has been lost, so another may start.
const READ_STALE = 10 * 60

// Readings are counted by calendar month, in UTC.
const readsKey = (pk: string): Item => ({ PK: { S: pk }, SK: { S: `READS#${new Date().toISOString().slice(0, 7)}` } })
const accountReads = (sub: string) => readsKey(accountKey(sub).S)
const APP_READS = 'APP'

// One more reading on a counter, unless it has reached its limit.
const countRead = (key: Item, limit: number) => ({
  Update: {
    TableName: TABLE,
    Key: key,
    UpdateExpression: 'ADD #count :one',
    ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit',
    // count is a reserved word.
    ExpressionAttributeNames: { '#count': 'count' },
    ExpressionAttributeValues: { ':one': { N: '1' }, ':limit': { N: String(limit) } },
  },
})

// The account's readings this month, and whether the app has any left.
export async function readUse(sub: string, limits: ReadLimits): Promise<ReadUse> {
  const count = async (key: Item) =>
    Number((await db.send(new GetItemCommand({ TableName: TABLE, Key: key }))).Item?.count?.N ?? 0)
  const [used, all] = await Promise.all([count(accountReads(sub)), count(readsKey(APP_READS))])
  return { used, limit: limits.account, open: all < limits.app }
}

// Starts a reading of the document's file and counts it against the account's and the app's limits, all in one
// write. The file must be checked, chosen when preprocessing changed it, and one page long, and no other
// reading of it may be under way. Answers the reading's id, or what stood in the way.
export async function startRead(sub: string, id: string, limits: ReadLimits) {
  // A counter not yet made passes its condition, so a limit of none is checked here.
  if (limits.account < 1) return 'read_limit'
  if (limits.app < 1) return 'read_unavailable'
  const readId = ulid()
  const { names, values } = live()
  try {
    await db.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Update: {
              TableName: TABLE,
              Key: docKey(sub, id),
              UpdateExpression: 'SET readId = :read, readStatus = :reading, readAt = :now REMOVE readResult',
              ConditionExpression: `${LIVE} AND #status = :done AND pages = :one AND (attribute_not_exists(fileChange) OR attribute_exists(fileUse)) AND (attribute_not_exists(readStatus) OR readStatus <> :reading OR readAt < :stale)`,
              ExpressionAttributeNames: { '#status': 'status', ...names },
              ExpressionAttributeValues: {
                ':read': { S: readId },
                ':reading': { S: 'reading' },
                ':done': status('done'),
                ':one': { N: '1' },
                ':stale': { N: String(now() - READ_STALE) },
                ...values,
              },
            },
          },
          countRead(accountReads(sub), limits.account),
          countRead(readsKey(APP_READS), limits.app),
        ],
      }),
    )
  } catch (err) {
    if (!(err instanceof TransactionCanceledException)) throw err
    const [doc, account, app] = (err.CancellationReasons ?? []).map((reason) => reason.Code === 'ConditionalCheckFailed')
    if (doc) return 'not_ready'
    if (account) return 'read_limit'
    if (app) return 'read_unavailable'
    throw err
  }
  return { readId }
}

// Ends a reading with its result, or as failed without one. A newer reading leaves this one's end unused.
export async function finishRead(sub: string, id: string, readId: string, result?: ReadResult) {
  await ifConditionMet(
    db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: result ? 'SET readStatus = :status, readResult = :result' : 'SET readStatus = :status',
        ConditionExpression: 'readId = :read AND readStatus = :reading',
        ExpressionAttributeValues: {
          ':status': { S: result ? 'done' : 'failed' },
          ':read': { S: readId },
          ':reading': { S: 'reading' },
          ...(result && { ':result': { S: JSON.stringify(result) } }),
        },
      }),
    ),
  )
}
