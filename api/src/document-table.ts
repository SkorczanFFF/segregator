import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  TransactionCanceledException,
  TransactWriteItemsCommand,
  UpdateItemCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import {
  DOC_PREFIX,
  TTL_ATTRIBUTE,
  type Document,
  type DocumentFile,
  type DocumentInput,
  type DocumentList,
  type DocumentRead,
  type DocumentStatus,
  type Draft,
  type FileChange,
  type FileType,
  type FileVersion,
  type ReadResult,
  type ReadUse,
} from 'shared'
import { ulid } from 'ulid'
import type { ReadLimits } from './read-limits.ts'
import { DAY, TABLE, db, deleteItems, ifConditionMet, now } from './table.ts'

type Item = Record<string, AttributeValue>

const PAGE_SIZE = 50
// A draft nobody saves is deleted with its files this long after it was made.
const DRAFT_KEEP = DAY

const status = (value: DocumentStatus) => ({ S: value })

// TTL removes an expired draft within a few days, so until then its time alone hides it, and no write
// touches it.
const expired = (item: Item) => Number(item[TTL_ATTRIBUTE]?.N) <= now()
const LIVE = '(attribute_not_exists(#ttl) OR #ttl > :now)'
const live = () => ({ names: { '#ttl': TTL_ATTRIBUTE }, values: { ':now': { N: String(now()) } } })

// Every key starts from the account, so a query can never reach another account's documents.
const accountKey = (sub: string) => ({ S: `USER#${sub}` })
const listKey = (sub: string) => `USER#${sub}#DOCS`

const docKey = (sub: string, id: string): Item => ({ PK: accountKey(sub), SK: { S: DOC_PREFIX + id } })

// Which document of an account holds a file, by the file's hash. Only a saved document takes its hash, so
// a draft left behind never stands in the way of the same file.
const hashKey = (sub: string, hash: string): Item => ({ PK: accountKey(sub), SK: { S: `HASH#${hash}` } })

// Another document of the account already holds the same file.
export class DuplicateFile extends Error {
  readonly id: string

  constructor(id: string) {
    super('duplicate')
    this.id = id
  }
}

// The account and document of a document's keys, as a table stream sends them.
export function parseDocKey(keys: Item) {
  const sub = /^USER#(.+)$/.exec(keys.PK?.S ?? '')?.[1]
  const sk = keys.SK?.S ?? ''
  const id = sk.startsWith(DOC_PREFIX) ? sk.slice(DOC_PREFIX.length) : undefined
  return sub && id ? { sub, id } : undefined
}

// What a person entered, and the keys that put the document on its account's list. A new item leaves out
// the undefined ones, and an update removes them.
const fieldAttributes = (sub: string, id: string, input: DocumentInput): Record<string, AttributeValue | undefined> => ({
  // GSI1 lists an account's documents by the date on the document; ISO dates sort as text.
  GSI1PK: { S: listKey(sub) },
  GSI1SK: { S: `${input.docDate}#${id}` },
  type: { S: input.type },
  issuer: { S: input.issuer },
  docDate: { S: input.docDate },
  subtype: input.subtype ? { S: input.subtype } : undefined,
  title: input.title ? { S: input.title } : undefined,
  amount: input.amount === undefined ? undefined : { N: String(input.amount) },
  dueDate: input.dueDate ? { S: input.dueDate } : undefined,
})

// The latest reading, with its result as the reader stored it.
const readOf = (item: Item): DocumentRead | undefined =>
  item.readId?.S
    ? {
        id: item.readId.S,
        status: item.readStatus?.S as DocumentRead['status'],
        ...(item.readResult?.S ? { result: JSON.parse(item.readResult.S) as ReadResult } : {}),
      }
    : undefined

function fromItem(item: Item): Document | Draft {
  const read = readOf(item)
  const stored = {
    id: item.id?.S ?? '',
    createdAt: item.createdAt?.S ?? '',
    // Documents from before the worker have no status, and all of them are done.
    status: (item.status?.S as DocumentStatus | undefined) ?? 'done',
    ...(item.fileType?.S
      ? {
          file: {
            type: item.fileType.S as FileType,
            size: Number(item.fileSize?.N),
            ...(item.pages?.N ? { pages: Number(item.pages.N) } : {}),
            ...(item.fileChange?.S ? { change: item.fileChange.S as FileChange } : {}),
            ...(item.fileUse?.S ? { use: item.fileUse.S as FileVersion } : {}),
          },
        }
      : {}),
    ...(read ? { read } : {}),
  }
  // Only saved fields put a document on the list.
  if (!item.GSI1PK) return { ...stored, draft: true }
  return {
    ...stored,
    type: item.type?.S as Document['type'],
    issuer: item.issuer?.S ?? '',
    docDate: item.docDate?.S ?? '',
    ...(item.subtype?.S ? { subtype: item.subtype.S } : {}),
    ...(item.title?.S ? { title: item.title.S } : {}),
    ...(item.amount?.N ? { amount: Number(item.amount.N) } : {}),
    ...(item.dueDate?.S ? { dueDate: item.dueDate.S } : {}),
  }
}

// A document without a file, done at once. ULIDs need no counter and sort by creation time.
export async function createDocument(sub: string, input: DocumentInput) {
  const doc: Document = { ...input, id: ulid(), createdAt: new Date().toISOString(), status: 'done' }
  const fields = Object.entries(fieldAttributes(sub, doc.id, input)).filter(([, value]) => value !== undefined)
  await db.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        ...docKey(sub, doc.id),
        id: { S: doc.id },
        createdAt: { S: doc.createdAt },
        status: status(doc.status),
        ...(Object.fromEntries(fields) as Item),
      },
    }),
  )
  return doc
}

// A document whose file comes first. It waits for the file, and expires unless its fields are saved. The size
// the upload declared counts against the storage from now on; the worker then sets the size it found.
export async function createDraft(sub: string, fileHash: string, fileSize: number) {
  const draft: Draft = { id: ulid(), createdAt: new Date().toISOString(), status: 'uploading', draft: true }
  await db.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        ...docKey(sub, draft.id),
        id: { S: draft.id },
        createdAt: { S: draft.createdAt },
        status: status(draft.status),
        fileHash: { S: fileHash },
        fileSize: { N: String(fileSize) },
        [TTL_ATTRIBUTE]: { N: String(now() + DRAFT_KEEP) },
      },
    }),
  )
  return draft
}

// Read consistently, so it shows a write made just before.
export async function getDocument(sub: string, id: string) {
  const { Item } = await db.send(new GetItemCommand({ TableName: TABLE, Key: docKey(sub, id), ConsistentRead: true }))
  return Item && !expired(Item) ? fromItem(Item) : undefined
}

// The document that holds this file, if any.
export async function findByHash(sub: string, hash: string) {
  const { Item } = await db.send(new GetItemCommand({ TableName: TABLE, Key: hashKey(sub, hash), ConsistentRead: true }))
  return Item?.id?.S
}

// The hash of a document's file, and whether the document is saved and so holds it.
async function fileHashOf(sub: string, id: string) {
  const { Item } = await db.send(
    new GetItemCommand({ TableName: TABLE, Key: docKey(sub, id), ProjectionExpression: 'fileHash, GSI1PK', ConsistentRead: true }),
  )
  return { hash: Item?.fileHash?.S, saved: Item?.GSI1PK !== undefined }
}

// Saves what a person entered and leaves the status and the file to the worker. A draft becomes a document
// on the list and stops expiring, but only once its file is checked and, for a photo preprocessing changed,
// a version is chosen. Undefined means no such document, or a draft not ready to save, so an edit never
// brings back a deleted one. A document with a file takes its hash in the same write, which throws
// DuplicateFile when another document of the account holds the file.
export async function updateDocument(sub: string, id: string, input: DocumentInput) {
  const attributes = Object.entries(fieldAttributes(sub, id, input))
  const set = attributes.filter(([, value]) => value !== undefined)
  const remove = attributes.filter(([, value]) => value === undefined).map(([name]) => `#${name}`)
  const { names, values } = live()
  const update = {
    TableName: TABLE,
    Key: docKey(sub, id),
    UpdateExpression: `SET ${set.map(([name]) => `#${name} = :${name}`).join(', ')} REMOVE ${[...remove, '#ttl'].join(', ')}`,
    ConditionExpression: `${LIVE} AND (attribute_exists(GSI1PK) OR (#status = :done AND (attribute_not_exists(fileChange) OR attribute_exists(fileUse))))`,
    // Names like type are reserved words, so every one goes through a placeholder.
    ExpressionAttributeNames: {
      ...Object.fromEntries([...attributes.map(([name]) => name), 'status'].map((name) => [`#${name}`, name])),
      ...names,
    },
    ExpressionAttributeValues: {
      ...(Object.fromEntries(set.map(([name, value]) => [`:${name}`, value])) as Item),
      ':done': status('done'),
      ...values,
    },
  }
  const { hash } = await fileHashOf(sub, id)
  if (!hash) {
    const updated = await ifConditionMet(db.send(new UpdateItemCommand({ ...update, ReturnValues: 'ALL_NEW' })))
    return updated?.Attributes && fromItem(updated.Attributes)
  }

  const holder = { ...hashKey(sub, hash), id: { S: id } }
  try {
    await db.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          { Update: update },
          {
            Put: {
              TableName: TABLE,
              Item: holder,
              // A document saved again keeps the hash it holds.
              ConditionExpression: 'attribute_not_exists(PK) OR id = :id',
              ExpressionAttributeValues: { ':id': holder.id },
              ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
            },
          },
        ],
      }),
    )
  } catch (err) {
    if (!(err instanceof TransactionCanceledException)) throw err
    const [fields, hold] = err.CancellationReasons ?? []
    if (fields?.Code === 'ConditionalCheckFailed') return undefined
    if (hold?.Code === 'ConditionalCheckFailed') throw new DuplicateFile(hold.Item?.id?.S ?? '')
    throw err
  }
  return getDocument(sub, id)
}

// Deletes the document, and frees its file's hash in the same write.
export async function deleteDocument(sub: string, id: string) {
  const { hash, saved } = await fileHashOf(sub, id)
  const document = { TableName: TABLE, Key: docKey(sub, id) }
  if (!hash || !saved) {
    await db.send(new DeleteItemCommand(document))
    return
  }
  await db.send(
    new TransactWriteItemsCommand({
      TransactItems: [{ Delete: document }, { Delete: { TableName: TABLE, Key: hashKey(sub, hash) } }],
    }),
  )
}

// The browser has sent the file, so the document shows as processing before the worker takes it.
// A document already further along, or gone, stays as it is.
export async function markSent(sub: string, id: string) {
  const { names, values } = live()
  await ifConditionMet(
    db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: 'SET #status = :processing',
        ConditionExpression: `#status = :uploading AND ${LIVE}`,
        ExpressionAttributeNames: { '#status': 'status', ...names },
        ExpressionAttributeValues: { ':uploading': status('uploading'), ':processing': status('processing'), ...values },
      }),
    ),
  )
}

// Gives the document to one message: a new upload, a failed one sent again, or this message's own
// earlier try. A document the browser marked as sent has no message yet. Taken means another message has
// it or the draft expired, gone means the document was deleted.
export async function claimDocument(sub: string, id: string, messageId: string) {
  const { names, values } = live()
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: 'SET #status = :processing, claimedBy = :message',
        ConditionExpression: `${LIVE} AND (#status IN (:uploading, :failed) OR (#status = :processing AND (attribute_not_exists(claimedBy) OR claimedBy = :message)))`,
        ExpressionAttributeNames: { '#status': 'status', ...names },
        ExpressionAttributeValues: {
          ':uploading': status('uploading'),
          ':processing': status('processing'),
          ':failed': status('failed'),
          ':message': { S: messageId },
          ...values,
        },
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
      }),
    )
    return 'claimed'
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err
    return err.Item ? 'taken' : 'gone'
  }
}

export type CheckResult = { status: 'done'; file: Omit<DocumentFile, 'use'> & { pages: number } } | { status: 'failed' }

// Ends this message's work on the document. A document deleted meanwhile stays deleted.
export async function settleDocument(sub: string, id: string, messageId: string, result: CheckResult) {
  const file = result.status === 'done' ? result.file : undefined
  const set = [
    '#status = :status',
    ...(file ? ['fileType = :type', 'fileSize = :size', 'pages = :pages'] : []),
    ...(file?.change ? ['fileChange = :change'] : []),
  ]
  await ifConditionMet(
    db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: `SET ${set.join(', ')} REMOVE claimedBy`,
        ConditionExpression: '#status = :processing AND claimedBy = :message',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': status(result.status),
          ':processing': status('processing'),
          ':message': { S: messageId },
          ...(file && {
            ':type': { S: file.type },
            ':size': { N: String(file.size) },
            ':pages': { N: String(file.pages) },
          }),
          ...(file?.change && { ':change': { S: file.change } }),
        },
      }),
    ),
  )
}

// Keeps one version of a photo that preprocessing changed. Undefined means no such photo.
export async function chooseVersion(sub: string, id: string, use: FileVersion) {
  const { names, values } = live()
  const updated = await ifConditionMet(
    db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: 'SET fileUse = :use',
        ConditionExpression: `attribute_exists(fileChange) AND ${LIVE}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: { ':use': { S: use }, ...values },
        ReturnValues: 'ALL_NEW',
      }),
    ),
  )
  return updated?.Attributes && fromItem(updated.Attributes)
}

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

// The bytes of every file the account keeps, drafts included from the moment their upload is signed, but not
// an expired draft. Summed on each upload: an account's items fit in a page or two, which costs less than
// keeping a counter right.
export async function storageUsed(sub: string) {
  let used = 0
  let startKey: Item | undefined
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :doc)',
        ProjectionExpression: 'fileSize, #ttl',
        ExpressionAttributeNames: { '#ttl': TTL_ATTRIBUTE },
        ExpressionAttributeValues: { ':pk': accountKey(sub), ':doc': { S: DOC_PREFIX } },
        ExclusiveStartKey: startKey,
      }),
    )
    for (const item of page.Items ?? []) if (!expired(item)) used += Number(item.fileSize?.N ?? 0)
    startKey = page.LastEvaluatedKey
  } while (startKey)
  return used
}

// Deletes all the account keeps in the table: documents, drafts, file fingerprints and counts of readings.
// Its sessions are keyed apart.
export async function deleteAccountItems(sub: string) {
  let startKey: Item | undefined
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk',
        ProjectionExpression: 'PK, SK',
        ExpressionAttributeValues: { ':pk': accountKey(sub) },
        ExclusiveStartKey: startKey,
      }),
    )
    await deleteItems(page.Items ?? [])
    startKey = page.LastEvaluatedKey
  } while (startKey)
}

// The cursor is the last key of a page. One that points outside the caller's list is rejected.
function readCursor(sub: string, cursor: string): Item | undefined {
  try {
    const key = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as Item
    return key.GSI1PK?.S === listKey(sub) ? key : undefined
  } catch {
    return undefined
  }
}

// Newest first by the date on the document. Drafts have no list keys, so they never show. Undefined means
// the cursor is invalid.
export async function listDocuments(sub: string, cursor?: string): Promise<DocumentList | undefined> {
  const startKey = cursor === undefined ? undefined : readCursor(sub, cursor)
  if (cursor !== undefined && !startKey) return undefined

  const { Items, LastEvaluatedKey } = await db.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': { S: listKey(sub) } },
      ScanIndexForward: false,
      Limit: PAGE_SIZE,
      ExclusiveStartKey: startKey,
    }),
  )
  return {
    // The filter only tells TypeScript what the list keys already guarantee.
    items: (Items ?? []).map(fromItem).filter((doc): doc is Document => !doc.draft),
    cursor: LastEvaluatedKey && Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64url'),
  }
}
