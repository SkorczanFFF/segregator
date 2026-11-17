import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CfnOutput, Duration, Fn, RemovalPolicy, SecretValue, Stack, Stage, type StackProps } from 'aws-cdk-lib/core'
import { HttpApi, HttpMethod, type CfnStage } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { DynamoEventSource, SqsDlq, SqsEventSource, type SqsEventSourceProps } from 'aws-cdk-lib/aws-lambda-event-sources'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as s3n from 'aws-cdk-lib/aws-s3-notifications'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'
import {
  AFTER_SIGN_IN_PATH,
  DOC_PREFIX,
  FILE_VERSIONS,
  GOOGLE_CALLBACK_PATH,
  PASSWORD_MIN_LENGTH,
  TTL_ATTRIBUTE,
  type FileVersion,
} from 'shared'

const WEB_DIST = fileURLToPath(new URL('../../web/dist', import.meta.url))
const API_ENTRY = fileURLToPath(new URL('../../api/src/index.ts', import.meta.url))
const PRE_SIGN_UP_ENTRY = fileURLToPath(new URL('../../api/src/pre-sign-up.ts', import.meta.url))
const WORKER_ENTRY = fileURLToPath(new URL('../../api/src/worker.ts', import.meta.url))
const DRAFT_CLEANUP_ENTRY = fileURLToPath(new URL('../../api/src/draft-cleanup.ts', import.meta.url))
const READER_ENTRY = fileURLToPath(new URL('../../api/src/reader.ts', import.meta.url))
const PREPROCESS_DIR = fileURLToPath(new URL('../../preprocess', import.meta.url))
// clientId and clientSecret of the OAuth client in Google Cloud, stored once by hand.
const GOOGLE_SECRET = 'segregator/google-oauth'

export const NODE = lambda.Runtime.NODEJS_24_X
export const PYTHON = lambda.Runtime.PYTHON_3_14

// The version alone, as in nodejs24.x or python3.14.
export const runtimeVersion = (runtime: lambda.Runtime) => runtime.name.replace(/^[a-z]+|\.x$/g, '')

const NODE_FUNCTION = {
  runtime: NODE,
  architecture: lambda.Architecture.ARM_64,
  // The runtime ships the SDK clients, but not helpers such as s3-presigned-post, so those are bundled.
  // Their ESM build imports the clients; the CommonJS one would require them, which an ES module can't.
  bundling: {
    format: nodejs.OutputFormat.ESM,
    minify: true,
    externalModules: ['@aws-sdk/client-*'],
    mainFields: ['module', 'main'],
  },
} satisfies nodejs.NodejsFunctionProps

// The Python code with its libraries for Linux on arm64. uv fetches those wheels on any machine, so bundling
// needs no Docker. The versions come from uv.lock and are checked against its hashes. Each stack needs its own.
const preprocessCode = () =>
  lambda.Code.fromAsset(PREPROCESS_DIR, {
    exclude: ['.venv', '.pytest_cache', '.ruff_cache', '**/__pycache__', 'tests'],
    bundling: {
      image: PYTHON.bundlingImage,
      local: {
        tryBundle(outputDir) {
          const requirements = join(mkdtempSync(join(tmpdir(), 'preprocess-')), 'requirements.txt')
          // Quiet unless it fails, when the error carries uv's message.
          const uv = (...args: string[]) => execFileSync('uv', args, { cwd: PREPROCESS_DIR, stdio: 'pipe' })
          uv('export', '--frozen', '--no-dev', '--output-file', requirements)
          uv(
            ...['pip', 'install', '--requirement', requirements, '--target', outputDir, '--no-deps'],
            ...['--only-binary', ':all:', '--python-platform', 'aarch64-manylinux_2_28'],
            ...['--python-version', runtimeVersion(PYTHON)],
          )
          for (const file of readdirSync(PREPROCESS_DIR).filter((name) => name.endsWith('.py'))) {
            cpSync(join(PREPROCESS_DIR, file), join(outputDir, file))
          }
          return true
        },
      },
    },
  })

// A message that fails this many times moves to its dead-letter queue. AWS advises at least 5, because
// a throttled call counts as a try too.
const MAX_RECEIVES = 5
// One message at a time, and at most two at once from a queue, the lowest limit SQS allows: dev and prod share
// the account's 10 functions running together, and their APIs need a share.
const ONE_BY_ONE = { batchSize: 1, reportBatchItemFailures: true, maxConcurrency: 2 } satisfies SqsEventSourceProps
const PREPROCESS_TIMEOUT = Duration.seconds(30)
const WORKER_TIMEOUT = Duration.seconds(15)
// The model takes up to half a minute on a PDF.
const READER_TIMEOUT = Duration.seconds(60)
// The model that reads documents, through its EU inference profile. The reader may call this one and no other.
const READ_MODEL = 'eu.amazon.nova-2-lite-v1:0'
// Readings a month, as set on the first deploy. Like the sign-up list, a change in Parameter Store stays until
// this value changes in the template.
const READ_LIMITS = { account: 100, app: 2000 }
// How far back the table can be restored, its longest. Older versions of files stay as long, so a restored
// document still has its file.
const RESTORE_DAYS = 35
// After this long a file is opened rarely, so it moves to a class about a fifth of the price that still opens
// at once. S3 leaves files under 128 kB where they are, since the class bills each file as at least that.
const ARCHIVE_AFTER = Duration.days(90)

// Well above a photo the browser prepares (PHOTO_MAX_SIDE in web/src/features/upload/prepare.ts). The cap
// stops a small file that unpacks into a huge image.
const MAX_PIXELS = 25_000_000

// Paths without a file extension belong to the client-side router.
const SPA_REWRITE = `function handler(event) {
  var request = event.request;
  if (request.uri.indexOf('.') === -1) request.uri = '/index.html';
  return request;
}`

// Mantine injects <style> tags, so styles need 'unsafe-inline'; scripts stay strict.
const CSP = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]

export type SiteProps = {
  domain: string
  // pnpm dev signs in through this stage's pool, so Google may also send people back to localhost.
  localDevelopment?: boolean
}

export class SegregatorStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps & SiteProps) {
    super(scope, id, props)
    const stageName = Stage.of(this)?.stageName
    const monthOfLogs = (id: string) =>
      new logs.LogGroup(this, id, { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY })

    const bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    const appUrl = `https://${props.domain}`
    const appUrls = [appUrl, ...(props.localDevelopment ? ['http://localhost:5173'] : [])]

    // Documents are personal data, so they get a key of their own. Rotation is off,
    // because each of its first two rounds adds 1 USD a month to the key's 1 USD.
    const documentsKey = new kms.Key(this, 'DocumentsKey')
    const documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryptionKey: documentsKey,
      // One data key for the bucket instead of a KMS request for every file.
      bucketKeyEnabled: true,
      // The browser posts files here directly, past the API.
      cors: [{ allowedOrigins: appUrls, allowedMethods: [s3.HttpMethods.POST] }],
      // A deleted or replaced file stays as an older version for RESTORE_DAYS.
      versioned: true,
      lifecycleRules: [
        {
          transitions: [{ storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL, transitionAfter: ARCHIVE_AFTER }],
          noncurrentVersionExpiration: Duration.days(RESTORE_DAYS),
          // A delete marker left with no versions behind it goes too.
          expiredObjectDeleteMarker: true,
        },
      ],
    })
    // The browser sends files to the bucket and shows them from it.
    const filesOrigin = `https://${documentsBucket.bucketRegionalDomainName}`

    const headers = new cloudfront.ResponseHeadersPolicy(this, 'WebHeaders', {
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          // blob: shows a file picked in the browser before it is sent.
          contentSecurityPolicy: [...CSP, `connect-src 'self' ${filesOrigin}`, `img-src 'self' blob: ${filesOrigin}`].join('; '),
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
      },
    })

    const userPool = new cognito.UserPool(this, 'Users', {
      // Lite covers password and Google sign-in; Essentials adds passkeys and email MFA.
      featurePlan: cognito.FeaturePlan.LITE,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      // Can't be changed after the pool is created.
      signInCaseSensitive: false,
      autoVerify: { email: true },
      userVerification: {
        emailSubject: 'Segregator: kod weryfikacyjny / verification code',
        emailBody: 'Kod weryfikacyjny / Verification code: {####}',
      },
      // Length over character classes, as NIST SP 800-63B recommends.
      passwordPolicy: {
        minLength: PASSWORD_MIN_LENGTH,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      deletionProtection: true,
    })

    // Cognito's own address for OAuth. Google sends people back to its /oauth2/idpresponse.
    const cognitoDomain = userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: `segregator-${stageName}` },
    })

    const google = new cognito.UserPoolIdentityProviderGoogle(this, 'Google', {
      userPool,
      clientId: SecretValue.secretsManager(GOOGLE_SECRET, { jsonField: 'clientId' }).unsafeUnwrap(),
      clientSecretValue: SecretValue.secretsManager(GOOGLE_SECRET, { jsonField: 'clientSecret' }),
      scopes: ['openid', 'email'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        emailVerified: cognito.ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
      },
    })

    const userPoolClient = userPool.addClient('ApiClient', {
      generateSecret: true,
      authFlows: { userPassword: true },
      preventUserExistenceErrors: true,
      // Without COGNITO, Cognito's own pages offer no password sign-up or reset that would skip the API's limits.
      // The API's password calls don't depend on this list.
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: appUrls.map((url) => url + GOOGLE_CALLBACK_PATH),
        // The callback ends Cognito's own session and lands here.
        logoutUrls: appUrls.map((url) => url + AFTER_SIGN_IN_PATH),
      },
      // The API drops Cognito tokens right after sign-in, so they can be short-lived.
      idTokenValidity: Duration.minutes(5),
      accessTokenValidity: Duration.minutes(5),
      refreshTokenValidity: Duration.minutes(60),
    })
    // The client can name Google only once the provider exists.
    userPoolClient.node.addDependency(google)

    // Sign-up is open to anyone ('*'). A list of addresses closes it to everyone else at once, without a deploy:
    // aws ssm put-parameter --name /segregator/<stage>/signup-allowlist --type StringList --value "a@example.com" --overwrite
    // CloudFormation sets '*' again only when this resource changes in the template.
    const signUpAllowlist = new ssm.StringListParameter(this, 'SignUpAllowlist', {
      parameterName: `/segregator/${stageName}/signup-allowlist`,
      stringListValue: ['*'],
    })

    const preSignUpFunction = new nodejs.NodejsFunction(this, 'PreSignUpFunction', {
      ...NODE_FUNCTION,
      entry: PRE_SIGN_UP_ENTRY,
      // Cognito waits up to 5 seconds for a trigger.
      timeout: Duration.seconds(5),
      environment: { SIGNUP_ALLOWLIST: signUpAllowlist.parameterName },
      logGroup: monthOfLogs('PreSignUpLogs'),
    })
    signUpAllowlist.grantRead(preSignUpFunction)
    // A policy of its own: in the function's default policy the pool would end up depending on itself.
    preSignUpFunction.role?.attachInlinePolicy(
      new iam.Policy(this, 'PreSignUpUsers', {
        statements: [
          new iam.PolicyStatement({
            actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminLinkProviderForUser'],
            resources: [userPool.userPoolArn],
          }),
        ],
      }),
    )
    userPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, preSignUpFunction)

    // One table for all data, keyed by PK and SK.
    const table = new dynamodb.TableV2(this, 'Table', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: TTL_ATTRIBUTE,
      // The keys of removed items, so the files of an expired draft can go too.
      dynamoStream: dynamodb.StreamViewType.KEYS_ONLY,
      // The data can be restored to any second of the last RESTORE_DAYS.
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true, recoveryPeriodInDays: RESTORE_DAYS },
      deletionProtection: true,
      // One index for per-user lists: an account's sessions and documents.
      globalSecondaryIndexes: [
        {
          indexName: 'GSI1',
          partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
        },
      ],
    })

    const apiFunction = new nodejs.NodejsFunction(this, 'ApiFunction', {
      ...NODE_FUNCTION,
      entry: API_ENTRY,
      // A cold start reads the client secret from Cognito before the first sign-in call.
      timeout: Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_DOMAIN: cognitoDomain.baseUrl(),
        APP_URL: appUrl,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
      },
      logGroup: monthOfLogs('ApiLogs'),
    })

    // Each version of a file sits under its own prefix, as in api/src/document-files.ts.
    const files = (version: FileVersion) => documentsBucket.arnForObjects(`${version}/*`)
    const allFiles = FILE_VERSIONS.map(files)

    table.grantReadWriteData(apiFunction)
    userPool.grant(apiFunction, 'cognito-idp:DescribeUserPoolClient', 'cognito-idp:AdminGetUser')
    // Signing an upload needs the right to put the file itself. Every version is shown and deleted.
    apiFunction.addToRolePolicy(new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [files('raw')] }))
    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['s3:GetObject', 's3:DeleteObject'], resources: allFiles }),
    )
    documentsKey.grantEncryptDecrypt(apiFunction)

    // Where failed messages wait, with its address among the outputs. 14 days, the most SQS keeps them.
    const deadLetterQueue = (id: string) => {
      const queue = new sqs.Queue(this, `${id}DeadLetters`, { enforceSSL: true, retentionPeriod: Duration.days(14) })
      new CfnOutput(this, `${id}DeadLettersUrl`, { value: queue.queueUrl })
      return queue
    }

    // Work waiting for a function. AWS advises a visibility timeout of six times the function's, so a retry after
    // throttling still fits.
    const workQueue = (id: string, timeout: Duration) =>
      new sqs.Queue(this, id, {
        enforceSSL: true,
        visibilityTimeout: Duration.seconds(timeout.toSeconds() * 6),
        deadLetterQueue: { queue: deadLetterQueue(id), maxReceiveCount: MAX_RECEIVES },
      })

    // A step of the background work: the files that land under one version's prefix wait for the step's function.
    const stepQueue = (id: string, version: FileVersion, timeout: Duration) => {
      const queue = workQueue(id, timeout)
      documentsBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(queue), {
        prefix: `${version}/`,
      })
      return queue
    }

    // A new file under raw/ goes to preprocess/, which writes a straightened copy under processed/.
    // The copy goes on to the worker, which checks the file and updates its document.
    const preprocessFunction = new lambda.Function(this, 'PreprocessFunction', {
      runtime: PYTHON,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler.handler',
      code: preprocessCode(),
      timeout: PREPROCESS_TIMEOUT,
      // OpenCV keeps several copies of a photo, and more memory also brings a faster CPU.
      memorySize: 1024,
      environment: {
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        OPENCV_IO_MAX_IMAGE_PIXELS: String(MAX_PIXELS),
        MAX_RECEIVES: String(MAX_RECEIVES),
      },
      logGroup: monthOfLogs('PreprocessLogs'),
    })
    // Only what preprocessing needs: read the original and write the copy.
    preprocessFunction.addToRolePolicy(new iam.PolicyStatement({ actions: ['s3:GetObject'], resources: [files('raw')] }))
    preprocessFunction.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [files('processed')] }),
    )
    documentsKey.grantEncryptDecrypt(preprocessFunction)
    preprocessFunction.addEventSource(new SqsEventSource(stepQueue('Uploads', 'raw', PREPROCESS_TIMEOUT), ONE_BY_ONE))

    const workerFunction = new nodejs.NodejsFunction(this, 'WorkerFunction', {
      ...NODE_FUNCTION,
      entry: WORKER_ENTRY,
      timeout: WORKER_TIMEOUT,
      // pdf.js reads a PDF whole, up to FILE_MAX_SIZE in shared/src/file.ts.
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        MAX_RECEIVES: String(MAX_RECEIVES),
      },
      logGroup: monthOfLogs('WorkerLogs'),
    })
    // Only what the check needs: read the file and what preprocessing did to it, update its document, and
    // delete the files of a document deleted before they arrived.
    table.grant(workerFunction, 'dynamodb:UpdateItem')
    workerFunction.addToRolePolicy(
      new iam.PolicyStatement({ actions: ['s3:GetObject', 's3:DeleteObject'], resources: allFiles }),
    )
    documentsKey.grantDecrypt(workerFunction)
    workerFunction.addEventSource(new SqsEventSource(stepQueue('Processed', 'processed', WORKER_TIMEOUT), ONE_BY_ONE))

    // A reading the API starts waits in a queue of its own for the reader, which asks the model for the fields.
    const readQueue = workQueue('Reads', READER_TIMEOUT)
    // Change without a deploy:
    // aws ssm put-parameter --name /segregator/<stage>/read-limits --value '{"account":100,"app":2000}' --overwrite
    const readLimits = new ssm.StringParameter(this, 'ReadLimits', {
      parameterName: `/segregator/${stageName}/read-limits`,
      stringValue: JSON.stringify(READ_LIMITS),
    })
    const readerFunction = new nodejs.NodejsFunction(this, 'ReaderFunction', {
      ...NODE_FUNCTION,
      entry: READER_ENTRY,
      timeout: READER_TIMEOUT,
      // A PDF goes to the model whole, up to FILE_MAX_SIZE in shared/src/file.ts.
      memorySize: 256,
      environment: {
        TABLE_NAME: table.tableName,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        MAX_RECEIVES: String(MAX_RECEIVES),
        READ_MODEL,
      },
      logGroup: monthOfLogs('ReaderLogs'),
    })
    // Only what a reading needs: the chosen version of the file, the document, and the one model.
    table.grant(readerFunction, 'dynamodb:GetItem', 'dynamodb:UpdateItem')
    readerFunction.addToRolePolicy(new iam.PolicyStatement({ actions: ['s3:GetObject'], resources: allFiles }))
    documentsKey.grantDecrypt(readerFunction)
    const readProfile = this.formatArn({ service: 'bedrock', resource: 'inference-profile', resourceName: READ_MODEL })
    readerFunction.addToRolePolicy(new iam.PolicyStatement({ actions: ['bedrock:InvokeModel'], resources: [readProfile] }))
    // The EU profile passes a request on to the model in any EU region, and the model takes it only that way.
    readerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:${this.partition}:bedrock:*::foundation-model/${READ_MODEL.replace(/^eu\./, '')}`],
        conditions: { StringEquals: { 'bedrock:InferenceProfileArn': readProfile } },
      }),
    )
    readerFunction.addEventSource(new SqsEventSource(readQueue, ONE_BY_ONE))
    apiFunction.addEnvironment('READ_QUEUE_URL', readQueue.queueUrl)
    apiFunction.addEnvironment('READ_LIMITS_PARAMETER', readLimits.parameterName)
    readQueue.grantSendMessages(apiFunction)
    readLimits.grantRead(apiFunction)

    // When TTL removes a draft nobody saved, its files go too. Only expiry removes items as the service
    // itself, and sessions expire in the same table, so the filter passes only documents.
    const draftCleanupFunction = new nodejs.NodejsFunction(this, 'DraftCleanupFunction', {
      ...NODE_FUNCTION,
      entry: DRAFT_CLEANUP_ENTRY,
      environment: { DOCUMENTS_BUCKET: documentsBucket.bucketName },
      logGroup: monthOfLogs('DraftCleanupLogs'),
    })
    draftCleanupFunction.addToRolePolicy(new iam.PolicyStatement({ actions: ['s3:DeleteObject'], resources: allFiles }))
    draftCleanupFunction.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        // A few drafts at once, well within the function's time. A failing batch is split to find the record
        // that fails.
        batchSize: 10,
        bisectBatchOnError: true,
        // As many tries as a queue gives a message. Without a limit a failing batch would hold up the stream.
        retryAttempts: MAX_RECEIVES - 1,
        // A failed batch leaves where its records are in the stream, which keeps them for 24 hours.
        onFailure: new SqsDlq(deadLetterQueue('DraftCleanup')),
        filters: [
          lambda.FilterCriteria.filter({
            eventName: lambda.FilterRule.isEqual('REMOVE'),
            userIdentity: {
              type: lambda.FilterRule.isEqual('Service'),
              principalId: lambda.FilterRule.isEqual('dynamodb.amazonaws.com'),
            },
            dynamodb: { Keys: { SK: { S: lambda.FilterRule.beginsWith(DOC_PREFIX) } } },
          }),
        ],
      }),
    )

    const integration = new HttpLambdaIntegration('ApiIntegration', apiFunction)
    const api = new HttpApi(this, 'Api', { defaultIntegration: integration, createDefaultStage: false })
    // Sign-in, sign-up and code requests get a stricter limit of their own against password guessing
    // and email floods. GET /api/auth/me stays outside it, because every page load calls it.
    const [authRoute] = api.addRoutes({ path: '/api/auth/{proxy+}', methods: [HttpMethod.POST], integration })
    const stage = api.addStage('DefaultStage', {
      stageName: '$default',
      autoDeploy: true,
      // Cost cap for bots and client-side loops. One person never needs more.
      throttle: { rateLimit: 5, burstLimit: 10 },
    })
    ;(stage.node.defaultChild as CfnStage).routeSettings = {
      // Raw CloudFormation JSON, so the keys keep CloudFormation's casing.
      'POST /api/auth/{proxy+}': { ThrottlingRateLimit: 1, ThrottlingBurstLimit: 5 },
    }
    stage.node.addDependency(authRoute)

    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      domainNames: [props.domain],
      certificate: acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        // CloudFront needs the certificate in us-east-1, where the account's SCP blocks CloudFormation,
        // so it is created once outside the stack and its ARN kept in this parameter.
        ssm.StringParameter.valueForStringParameter(this, `/segregator/${stageName}/certificate-arn`),
      ),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: headers,
        functionAssociations: [
          {
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            function: new cloudfront.Function(this, 'SpaRewrite', {
              code: cloudfront.FunctionCode.fromInline(SPA_REWRITE),
            }),
          },
        ],
      },
      additionalBehaviors: {
        // No SPA rewrite here: API paths have no file extension either.
        '/api/*': {
          origin: new HttpOrigin(Fn.select(2, Fn.split('/', api.apiEndpoint))),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: headers,
        },
      },
    })

    // Two deployments so the hashed assets and the files with fixed names can get different Cache-Control.
    // Each one excludes the other's files, so pruning never deletes them.
    const assets = new s3deploy.BucketDeployment(this, 'DeployAssets', {
      sources: [s3deploy.Source.asset(WEB_DIST)],
      destinationBucket: bucket,
      exclude: ['*'],
      include: ['assets/*'],
      // File names change with content, so a cached copy is never stale.
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(Duration.days(365)),
        s3deploy.CacheControl.immutable(),
      ],
    })

    // index.html and the files from web/public, such as the logo, keep their names on every deploy, so the browser
    // must revalidate them each time. One wildcard path clears them all from CloudFront; the hashed assets it also
    // clears are only fetched from the bucket again.
    const index = new s3deploy.BucketDeployment(this, 'DeployIndex', {
      sources: [s3deploy.Source.asset(WEB_DIST)],
      destinationBucket: bucket,
      exclude: ['assets/*'],
      cacheControl: [s3deploy.CacheControl.noCache()],
      distribution,
      distributionPaths: ['/*'],
    })
    // New index.html must never point at assets that are not uploaded yet.
    index.node.addDependency(assets)

    new CfnOutput(this, 'Url', { value: appUrl })
    // Target of the DNS record that points a custom domain at the distribution.
    new CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName })
    // Values for api/.env when the API runs locally.
    new CfnOutput(this, 'TableName', { value: table.tableName })
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId })
    new CfnOutput(this, 'CognitoDomain', { value: cognitoDomain.baseUrl() })
    new CfnOutput(this, 'DocumentsBucketName', { value: documentsBucket.bucketName })
    new CfnOutput(this, 'ReadQueueUrl', { value: readQueue.queueUrl })
    new CfnOutput(this, 'ReadLimitsParameter', { value: readLimits.parameterName })
  }
}
