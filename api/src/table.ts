import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'

export const db = new DynamoDBClient({})
export const TABLE = process.env.TABLE_NAME ?? ''

export const DAY = 24 * 60 * 60

export const now = () => Math.floor(Date.now() / 1000)

// A write with a condition. Undefined means the condition failed.
export async function ifConditionMet<T>(write: Promise<T>) {
  try {
    return await write
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return undefined
    throw err
  }
}
