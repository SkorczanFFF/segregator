import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import * as z from 'zod'

const sqs = new SQSClient({})

// One reading for the reader function: which document, and which reading of it.
export const ReadJob = z.object({ sub: z.string(), id: z.string(), readId: z.string() })

export type ReadJob = z.infer<typeof ReadJob>

export async function queueRead(job: ReadJob) {
  await sqs.send(new SendMessageCommand({ QueueUrl: process.env.READ_QUEUE_URL, MessageBody: JSON.stringify(job) }))
}
