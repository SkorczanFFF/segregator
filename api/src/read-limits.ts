import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import * as z from 'zod'

const ssm = new SSMClient({})

// Readings a month: for one account, and for the whole app, which caps the cost of every account together.
const ReadLimits = z.object({ account: z.number().int().min(0), app: z.number().int().min(0) })

export type ReadLimits = z.infer<typeof ReadLimits>

// Kept this long in the function's memory, so a change in Parameter Store applies within minutes.
const KEEP_MS = 5 * 60 * 1000

let kept: { limits: ReadLimits; until: number } | undefined

// The limits from Parameter Store, which the stack creates and a person may change without a deploy.
export async function readLimits() {
  if (kept && Date.now() < kept.until) return kept.limits
  const { Parameter } = await ssm.send(new GetParameterCommand({ Name: process.env.READ_LIMITS_PARAMETER }))
  const limits = ReadLimits.parse(JSON.parse(Parameter?.Value ?? ''))
  kept = { limits, until: Date.now() + KEEP_MS }
  return limits
}
