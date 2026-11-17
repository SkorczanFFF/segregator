import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import type {
  Document,
  DocumentFile,
  DocumentInput,
  DocumentList,
  DocumentStatus,
  Draft,
  FileChange,
  FileType,
  FileVersion,
} from 'shared'
import { ulid } from 'ulid'

type Item = Record<string, AttributeValue>

const db = new DynamoDBClient({})
const TABLE = process.env.TABLE_NAME ?? ''
const PAGE_SIZE = 50
// A draft nobody saves is deleted with its files this long after it was made.
const DRAFT_KEEP = 24 * 60 * 60

const now = () => Math.floor(Date.now() / 1000)

// Every key starts from the account, so a query can never reach another account's documents.
const listKey = (sub: string) => `USER#${sub}#DOCS`

const docKey = (sub: string, id: string): Item => ({ PK: { S: `USER#${sub}` }, SK: { S: `DOC#${id}` } })

// The account and document of a document's keys, as a table stream sends them.
export function parseDocKey(keys: Item) {
  const sub = /^USER#(.+)$/.exec(keys.PK?.S ?? '')?.[1]
  const id = /^DOC#(.+)$/.exec(keys.SK?.S ?? '')?.[1]
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
})

// TTL deletes an expired draft within a few days, so until then its time alone hides it.
const expired = (item: Item) => item.expiresAt?.N !== undefined && Number(item.expiresAt.N) <= now()

function fromItem(item: Item): Document | Draft {
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
        status: { S: doc.status },
        ...(Object.fromEntries(fields) as Item),
      },
    }),
  )
  return doc
}

// A document whose file comes first. It waits for the file, and expires unless its fields are saved.
export async function createDraft(sub: string) {
  const draft: Draft = { id: ulid(), createdAt: new Date().toISOString(), status: 'uploading', draft: true }
  await db.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        ...docKey(sub, draft.id),
        id: { S: draft.id },
        createdAt: { S: draft.createdAt },
        status: { S: draft.status },
        expiresAt: { N: String(now() + DRAFT_KEEP) },
      },
    }),
  )
  return draft
}

export async function getDocument(sub: string, id: string) {
  const { Item } = await db.send(new GetItemCommand({ TableName: TABLE, Key: docKey(sub, id) }))
  return Item && !expired(Item) ? fromItem(Item) : undefined
}

// Saves what a person entered and leaves the status and the file to the worker. A draft becomes a document
// on the list and stops expiring, but only once its file is checked. Undefined means no such document,
// or a draft not ready to save, so an edit never brings back a deleted one.
export async function updateDocument(sub: string, id: string, input: DocumentInput) {
  const attributes = Object.entries(fieldAttributes(sub, id, input))
  const set = attributes.filter(([, value]) => value !== undefined)
  const remove = [...attributes.filter(([, value]) => value === undefined).map(([name]) => name), 'expiresAt']
  try {
    const { Attributes } = await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: `SET ${set.map(([name]) => `#${name} = :${name}`).join(', ')} REMOVE ${remove.map((name) => `#${name}`).join(', ')}`,
        ConditionExpression: 'attribute_exists(PK) AND (attribute_exists(GSI1PK) OR #status = :done)',
        // Names like type are reserved words, so every one goes through a placeholder.
        ExpressionAttributeNames: Object.fromEntries(
          [...attributes.map(([name]) => name), 'expiresAt', 'status'].map((name) => [`#${name}`, name]),
        ),
        ExpressionAttributeValues: {
          ...(Object.fromEntries(set.map(([name, value]) => [`:${name}`, value])) as Item),
          ':done': { S: 'done' },
        },
        ReturnValues: 'ALL_NEW',
      }),
    )
    return Attributes && fromItem(Attributes)
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return undefined
    throw err
  }
}

export async function deleteDocument(sub: string, id: string) {
  await db.send(new DeleteItemCommand({ TableName: TABLE, Key: docKey(sub, id) }))
}

// The browser has sent the file, so the document shows as processing before the worker takes it.
// A document already further along, or gone, stays as it is.
export async function markSent(sub: string, id: string) {
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: 'SET #status = :processing',
        ConditionExpression: '#status = :uploading',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':uploading': { S: 'uploading' }, ':processing': { S: 'processing' } },
      }),
    )
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err
  }
}

// Gives the document to one message: a new upload, a failed one sent again, or this message's own
// earlier try. A document the browser marked as sent has no message yet. False means another message
// has it or the document is gone.
export async function claimDocument(sub: string, id: string, messageId: string) {
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: 'SET #status = :processing, claimedBy = :message',
        ConditionExpression:
          '#status IN (:uploading, :failed) OR (#status = :processing AND (attribute_not_exists(claimedBy) OR claimedBy = :message))',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':uploading': { S: 'uploading' },
          ':processing': { S: 'processing' },
          ':failed': { S: 'failed' },
          ':message': { S: messageId },
        },
      }),
    )
    return true
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false
    throw err
  }
}

export type CheckResult = { status: 'done'; file: DocumentFile } | { status: 'failed' }

// Ends this message's work on the document. A document deleted meanwhile stays deleted.
export async function settleDocument(sub: string, id: string, messageId: string, result: CheckResult) {
  const file = result.status === 'done' ? result.file : undefined
  const set = [
    '#status = :status',
    ...(file ? ['fileType = :type', 'fileSize = :size', 'pages = :pages'] : []),
    ...(file?.change ? ['fileChange = :change'] : []),
  ]
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: `SET ${set.join(', ')} REMOVE claimedBy`,
        ConditionExpression: '#status = :processing AND claimedBy = :message',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': { S: result.status },
          ':processing': { S: 'processing' },
          ':message': { S: messageId },
          ...(file && {
            ':type': { S: file.type },
            ':size': { N: String(file.size) },
            ':pages': { N: String(file.pages) },
          }),
          ...(file?.change && { ':change': { S: file.change } }),
        },
      }),
    )
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err
  }
}

// Keeps one version of a photo that preprocessing changed. Undefined means no such photo.
export async function chooseVersion(sub: string, id: string, use: FileVersion) {
  try {
    const { Attributes } = await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: 'SET fileUse = :use',
        ConditionExpression: 'attribute_exists(fileChange)',
        ExpressionAttributeValues: { ':use': { S: use } },
        ReturnValues: 'ALL_NEW',
      }),
    )
    return Attributes && fromItem(Attributes)
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return undefined
    throw err
  }
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
    items: (Items ?? []).map(fromItem).filter((doc): doc is Document => !doc.draft),
    cursor: LastEvaluatedKey && Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64url'),
  }
}
