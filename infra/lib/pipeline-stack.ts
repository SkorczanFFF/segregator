import { createRequire } from 'node:module'
import { Stack, Stage, type StackProps, type StageProps } from 'aws-cdk-lib/core'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import { CfnConnection } from 'aws-cdk-lib/aws-codestarconnections'
import { PipelineType } from 'aws-cdk-lib/aws-codepipeline'
import * as pipelines from 'aws-cdk-lib/pipelines'
import type { Construct } from 'constructs'
import { SegregatorStack } from './segregator-stack.ts'

const REPO = 'SkorczanFFF/segregator'

// Versions from the lockfile, so CodeBuild never installs a release younger than our pnpm policy allows.
const version = (pkg: string): string => createRequire(import.meta.url)(`${pkg}/package.json`).version

class AppStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props)
    new SegregatorStack(this, 'Segregator')
  }
}

// AWS pulls the code through a GitHub app connection, so GitHub holds no AWS credentials.
// The account's managed SCP blocks IAM identity providers, which rules out GitHub OIDC.
export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    // Created as PENDING; it has to be authorized once in the console.
    const connection = new CfnConnection(this, 'GitHub', {
      connectionName: 'segregator-github',
      providerType: 'GitHub',
    })

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: 'segregator',
      pipelineType: PipelineType.V2,
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection(REPO, 'main', {
          connectionArn: connection.attrConnectionArn,
        }),
        env: { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
        installCommands: ['corepack enable'],
        commands: ['pnpm install --frozen-lockfile', 'pnpm build', 'pnpm cdk synth'],
        primaryOutputDirectory: 'infra/cdk.out',
      }),
      cliVersion: version('aws-cdk'),
      cdkAssetsCliVersion: version('cdk-assets'),
      // Fewer actions per run means fewer billed minutes.
      publishAssetsInParallel: false,
      useChangeSets: false,
      codeBuildDefaults: {
        buildEnvironment: { buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2023_6 },
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          phases: { install: { 'runtime-versions': { nodejs: 24 } } },
        }),
      },
    })

    pipeline.addStage(new AppStage(this, 'dev', { env: props?.env }))
    pipeline.addStage(new AppStage(this, 'prod', { env: props?.env }), {
      pre: [new pipelines.ManualApprovalStep('Approve')],
    })
  }
}
