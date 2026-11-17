import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { createHash, randomUUID } from 'node:crypto'
import { after, before } from 'node:test'

// A made-up hash of a file, different every time.
export const randomHash = () => createHash('sha256').update(randomUUID()).digest('hex')

// Points the data layer at a fresh table in DynamoDB Local for one test file.
// Call it before importing the modules under test, because they read these variables when they load.
export function setUpLocalTable(name: string) {
  process.env.AWS_ENDPOINT_URL_DYNAMODB = 'http://localhost:8000'
  process.env.AWS_REGION = 'eu-north-1'
  process.env.AWS_ACCESS_KEY_ID = 'local'
  process.env.AWS_SECRET_ACCESS_KEY = 'local'
  process.env.TABLE_NAME = name

  const db = new DynamoDBClient({})

  // Same keys and index as the table in infra/lib/segregator-stack.ts.
  before(() =>
    db.send(
      new CreateTableCommand({
        TableName: name,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: ['PK', 'SK', 'GSI1PK', 'GSI1SK'].map((attribute) => ({
          AttributeName: attribute,
          AttributeType: 'S',
        })),
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      }),
    ),
  )

  after(() => db.send(new DeleteTableCommand({ TableName: name })))
}
