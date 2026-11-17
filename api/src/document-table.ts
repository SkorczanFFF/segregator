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
import type { Document, DocumentFile, DocumentInput, DocumentList, DocumentStatus, FileType } from 'shared'
import { ulid } from 'ulid'
import { UPLOAD_SECONDS } from './document-files.ts'

type Item = Record<string, AttributeValue>

const db = new DynamoDBClient({})
const TABLE = process.env.TABLE_NAME ?? ''
const PAGE_SIZE = 50
// A document whose file never came leaves the list this long after the upload was signed.
const UPLOAD_WAIT = UPLOAD_SECONDS + 5 * 60
// TTL deletes it later than the 14 days a message can wait in a dead-letter queue, so a document whose file
// got stuck in preprocessing is still here when its message is sent back.
const UPLOAD_KEEP = 30 * 24 * 60 * 60

const now = () => Math.floor(Date.now() / 1000)

// Every key starts from the account, so a query can never reach another account's documents.
const listKey = (sub: string) => `USER#${sub}#DOCS`

const docKey = (sub: string, id: string): Item => ({ PK: { S: `USER#${sub}` }, SK: { S: `DOC#${id}` } })

// What a person entered. A new item leaves out the undefined ones, and an update removes them.
const fieldAttributes = (id: string, input: DocumentInput): Record<string, AttributeValue | undefined> => ({
  // GSI1 lists an account's documents by the date on the document; ISO dates sort as text.
  GSI1SK: { S: `${input.docDate}#${id}` },
  type: { S: input.type },
  issuer: { S: input.issuer },
  docDate: { S: input.docDate },
  subtype: input.subtype ? { S: input.subtype } : undefined,
  title: input.title ? { S: input.title } : undefined,
  amount: input.amount === undefined ? undefined : { N: String(input.amount) },
})

// Uploads signed before this, still waiting, are gone for the person.
const uploadCutoff = () => new Date(Date.now() - UPLOAD_WAIT * 1000).toISOString()

const abandoned = (item: Item) => item.status?.S === 'uploading' && (item.createdAt?.S ?? '') <= uploadCutoff()

function fromItem(item: Item): Document {
  return {
    id: item.id?.S ?? '',
    createdAt: item.createdAt?.S ?? '',
    // Documents from before the worker have no status, and all of them are done.
    status: (item.status?.S as DocumentStatus | undefined) ?? 'done',
    type: item.type?.S as Document['type'],
    issuer: item.issuer?.S ?? '',
    docDate: item.docDate?.S ?? '',
    ...(item.subtype?.S ? { subtype: item.subtype.S } : {}),
    ...(item.title?.S ? { title: item.title.S } : {}),
    ...(item.amount?.N ? { amount: Number(item.amount.N) } : {}),
    ...(item.fileType?.S
      ? {
          file: {
            type: item.fileType.S as FileType,
            size: Number(item.fileSize?.N),
            ...(item.pages?.N ? { pages: Number(item.pages.N) } : {}),
          },
        }
      : {}),
  }
}

// A document with a file starts as uploading, and the worker takes it from there. ULIDs need no counter
// and sort by creation time.
export async function createDocument(sub: string, input: DocumentInput, withFile = false) {
  const doc: Document = { ...input, id: ulid(), createdAt: new Date().toISOString(), status: withFile ? 'uploading' : 'done' }
  const fields = Object.entries(fieldAttributes(doc.id, input)).filter(([, value]) => value !== undefined)
  await db.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: {
        ...docKey(sub, doc.id),
        GSI1PK: { S: listKey(sub) },
        id: { S: doc.id },
        createdAt: { S: doc.createdAt },
        status: { S: doc.status },
        ...(Object.fromEntries(fields) as Item),
        ...(withFile ? { expiresAt: { N: String(now() + UPLOAD_KEEP) } } : {}),
      },
    }),
  )
  return doc
}

export async function getDocument(sub: string, id: string) {
  const { Item } = await db.send(new GetItemCommand({ TableName: TABLE, Key: docKey(sub, id) }))
  return Item && !abandoned(Item) ? fromItem(Item) : undefined
}

// Replaces what a person entered and leaves the status and the file to the worker. Undefined means
// no such document, so an edit never brings back a deleted one.
export async function updateDocument(sub: string, id: string, input: DocumentInput) {
  const attributes = Object.entries(fieldAttributes(id, input))
  const set = attributes.filter(([, value]) => value !== undefined)
  const remove = attributes.filter(([, value]) => value === undefined)
  try {
    const { Attributes } = await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: [
          `SET ${set.map(([name]) => `#${name} = :${name}`).join(', ')}`,
          remove.length ? `REMOVE ${remove.map(([name]) => `#${name}`).join(', ')}` : '',
        ].join(' '),
        ConditionExpression: 'attribute_exists(PK)',
        // Names like type are reserved words, so every one goes through a placeholder.
        ExpressionAttributeNames: Object.fromEntries(attributes.map(([name]) => [`#${name}`, name])),
        ExpressionAttributeValues: Object.fromEntries(set.map(([name, value]) => [`:${name}`, value])) as Item,
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

// Gives the document to one message: a new upload, a failed one sent again, or this message's own
// earlier try. False means another message has it or the document is gone.
export async function claimDocument(sub: string, id: string, messageId: string) {
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        // The file is here, so the document no longer expires.
        UpdateExpression: 'SET #status = :processing, claimedBy = :message REMOVE expiresAt',
        ConditionExpression: '#status IN (:uploading, :failed) OR (#status = :processing AND claimedBy = :message)',
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
  try {
    await db.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: docKey(sub, id),
        UpdateExpression: `SET #status = :status${file ? ', fileType = :type, fileSize = :size, pages = :pages' : ''} REMOVE claimedBy`,
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
        },
      }),
    )
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) throw err
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

// Newest first by the date on the document. Undefined means the cursor is invalid.
export async function listDocuments(sub: string, cursor?: string): Promise<DocumentList | undefined> {
  const startKey = cursor === undefined ? undefined : readCursor(sub, cursor)
  if (cursor !== undefined && !startKey) return undefined

  const { Items, LastEvaluatedKey } = await db.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      // Same rule as abandoned().
      FilterExpression: '#status <> :uploading OR createdAt > :cutoff',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': { S: listKey(sub) },
        ':uploading': { S: 'uploading' },
        ':cutoff': { S: uploadCutoff() },
      },
      ScanIndexForward: false,
      Limit: PAGE_SIZE,
      ExclusiveStartKey: startKey,
    }),
  )
  return {
    items: (Items ?? []).map(fromItem),
    cursor: LastEvaluatedKey && Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64url'),
  }
}
