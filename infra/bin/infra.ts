#!/usr/bin/env node
import { App } from 'aws-cdk-lib/core'
import { SegregatorStack } from '../lib/segregator-stack.ts'

const app = new App()
new SegregatorStack(app, 'SegregatorStack')
