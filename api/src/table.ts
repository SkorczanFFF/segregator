import {
  BatchWriteItemCommand,
  ConditionalCheckFailedException,
  DynamoDBClient,
  type AttributeValue,
  type WriteRequest,
} from '@aws-sdk/client-dynamodb'

export const db = new DynamoDBClient({})
export const TABLE = process.env.TABLE_NAME ?? ''

export const DAY = 24 * 60 * 60

export const now = () => Math.floor(Date.now() / 1000)

// Deletes the items with these keys. BatchWriteItem takes 25 at a time and may hand some back to retry.
export async function deleteItems(keys: Record<string, AttributeValue>[]) {
  for (let i = 0; i < keys.length; i += 25) {
    let pending: Record<string, WriteRequest[]> = {
      [TABLE]: keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } })),
    }
    while (Object.keys(pending).length > 0) {
      const { UnprocessedItems } = await db.send(new BatchWriteItemCommand({ RequestItems: pending }))
      pending = UnprocessedItems ?? {}
    }
  }
}

// A write with a condition. Undefined means the condition failed.
export async function ifConditionMet<T>(write: Promise<T>) {
  try {
    return await write
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return undefined
    throw err
  }
}
