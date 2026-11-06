import { Stack, type StackProps } from 'aws-cdk-lib/core'
import type { Construct } from 'constructs'

export class SegregatorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)
  }
}
