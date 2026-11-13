import { DynamoDBClient, PutItemCommand, QueryCommand, type AttributeValue } from '@aws-sdk/client-dynamodb'
import type { Document, DocumentInput } from 'shared'
import { ulid } from 'ulid'

type Item = Record<string, AttributeValue>

const db = new DynamoDBClient({})
const TABLE = process.env.TABLE_NAME ?? ''
const PAGE_SIZE = 50

// Every key starts from the account, so a query can never reach another account's documents.
const listKey = (sub: string) => `USER#${sub}#DOCS`

function toItem(sub: string, doc: Document): Item {
  return {
    PK: { S: `USER#${sub}` },
    SK: { S: `DOC#${doc.id}` },
    // GSI1 lists an account's documents by the date on the document; ISO dates sort as text.
    GSI1PK: { S: listKey(sub) },
    GSI1SK: { S: `${doc.docDate}#${doc.id}` },
    id: { S: doc.id },
    createdAt: { S: doc.createdAt },
    type: { S: doc.type },
    issuer: { S: doc.issuer },
    docDate: { S: doc.docDate },
    ...(doc.subtype ? { subtype: { S: doc.subtype } } : {}),
    ...(doc.title ? { title: { S: doc.title } } : {}),
    ...(doc.amount !== undefined ? { amount: { N: String(doc.amount) } } : {}),
  }
}

function fromItem(item: Item): Document {
  return {
    id: item.id?.S ?? '',
    createdAt: item.createdAt?.S ?? '',
    type: item.type?.S as Document['type'],
    issuer: item.issuer?.S ?? '',
    docDate: item.docDate?.S ?? '',
    ...(item.subtype?.S ? { subtype: item.subtype.S } : {}),
    ...(item.title?.S ? { title: item.title.S } : {}),
    ...(item.amount?.N ? { amount: Number(item.amount.N) } : {}),
  }
}

export async function createDocument(sub: string, input: DocumentInput): Promise<Document> {
  // ULIDs need no counter and sort by creation time.
  const doc: Document = { ...input, id: ulid(), createdAt: new Date().toISOString() }
  await db.send(new PutItemCommand({ TableName: TABLE, Item: toItem(sub, doc) }))
  return doc
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
export async function listDocuments(sub: string, cursor?: string) {
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
    items: (Items ?? []).map(fromItem),
    cursor: LastEvaluatedKey && Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64url'),
  }
}
