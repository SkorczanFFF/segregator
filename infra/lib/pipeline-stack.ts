import { createRequire } from 'node:module'
import { Stack, Stage, type StackProps, type StageProps } from 'aws-cdk-lib/core'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import { CfnConnection } from 'aws-cdk-lib/aws-codestarconnections'
import * as pipelines from 'aws-cdk-lib/pipelines'
import type { Construct } from 'constructs'
import { NODE, PYTHON, runtimeVersion, SegregatorStack, type SiteProps } from './segregator-stack.ts'

const REPO = 'SkorczanFFF/segregator'

// Versions from the lockfile, so CodeBuild never installs a release younger than our pnpm policy allows.
const version = (pkg: string): string => createRequire(import.meta.url)(`${pkg}/package.json`).version

class AppStage extends Stage {
  constructor(scope: Construct, id: string, props: StageProps & SiteProps) {
    super(scope, id, props)
    new SegregatorStack(this, 'Segregator', { domain: props.domain, localDevelopment: props.localDevelopment })
  }
}

// AWS pulls the code through a GitHub app connection, so GitHub holds no AWS credentials.
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
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.connection(REPO, 'main', {
          connectionArn: connection.attrConnectionArn,
        }),
        env: { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
        installCommands: [
          'corepack enable',
          // uv bundles the Python function, at the version preprocess/pyproject.toml requires.
          `pip3 install "uv$(sed -n 's/^required-version = "\\(.*\\)"$/\\1/p' preprocess/pyproject.toml)"`,
        ],
        commands: ['pnpm install --frozen-lockfile', 'pnpm build', 'pnpm cdk synth'],
        primaryOutputDirectory: 'infra/cdk.out',
      }),
      cliVersion: version('aws-cdk'),
      cdkAssetsCliVersion: version('cdk-assets'),
      publishAssetsInParallel: false,
      useChangeSets: false,
      codeBuildDefaults: {
        buildEnvironment: { buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2023_6 },
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          // Only the runtimes named here are on the image, the same as the functions'. Python brings pip, which
          // installs uv, and uv bundles the Python function without fetching another Python.
          phases: { install: { 'runtime-versions': { nodejs: runtimeVersion(NODE), python: runtimeVersion(PYTHON) } } },
        }),
      },
    })

    pipeline.addStage(
      new AppStage(this, 'dev', {
        env: props?.env,
        domain: 'dev.segregator.skoftware.pl',
        localDevelopment: true,
      }),
    )
    const prod = new AppStage(this, 'prod', {
      env: props?.env,
      domain: 'segregator.skoftware.pl',
    })
    pipeline.addStage(prod, {
      pre: [new pipelines.ManualApprovalStep('Approve')],
    })
  }
}
