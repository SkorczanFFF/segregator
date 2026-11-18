import { DOC_PREFIX, TTL_ATTRIBUTE, type DocumentStatus } from 'shared'
import { now, type Item } from './table.ts'

export const status = (value: DocumentStatus) => ({ S: value })

// TTL removes an expired draft within a few days, so until then its time alone hides it, and no write
// touches it.
export const expired = (item: Item) => Number(item[TTL_ATTRIBUTE]?.N) <= now()
export const LIVE = '(attribute_not_exists(#ttl) OR #ttl > :now)'
export const live = () => ({ names: { '#ttl': TTL_ATTRIBUTE }, values: { ':now': { N: String(now()) } } })

// Every key starts from the account, so a query can never reach another account's documents.
export const accountKey = (sub: string) => ({ S: `USER#${sub}` })

export const docKey = (sub: string, id: string): Item => ({ PK: accountKey(sub), SK: { S: DOC_PREFIX + id } })
