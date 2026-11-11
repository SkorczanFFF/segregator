#!/usr/bin/env node
import { App } from 'aws-cdk-lib/core'
import { PipelineStack } from '../lib/pipeline-stack.ts'

const app = new App()
new PipelineStack(app, 'SegregatorPipeline', {
  // Taken from the active AWS credentials, so the account ID stays out of the repo.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
})
