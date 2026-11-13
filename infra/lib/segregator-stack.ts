import { fileURLToPath } from 'node:url'
import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib/core'
import { HttpApi, HttpMethod, type CfnStage } from 'aws-cdk-lib/aws-apigatewayv2'
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import type { Construct } from 'constructs'

const WEB_DIST = fileURLToPath(new URL('../../web/dist', import.meta.url))
const API_ENTRY = fileURLToPath(new URL('../../api/src/index.ts', import.meta.url))

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
].join('; ')

export type Domain = {
  name: string
  // CloudFront needs the certificate in us-east-1, where the account's SCP blocks CloudFormation,
  // so it is created once outside the stack and its ARN read from this parameter.
  certificateArnParameter: string
}

export class SegregatorStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps & { domain?: Domain }) {
    super(scope, id, props)

    const bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    const headers = new cloudfront.ResponseHeadersPolicy(this, 'WebHeaders', {
      securityHeadersBehavior: {
        contentSecurityPolicy: { contentSecurityPolicy: CSP, override: true },
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
        minLength: 12,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      deletionProtection: true,
    })

    const userPoolClient = userPool.addClient('ApiClient', {
      generateSecret: true,
      authFlows: { userPassword: true },
      preventUserExistenceErrors: true,
      disableOAuth: true,
      // The API drops Cognito tokens right after sign-in, so they can be short-lived.
      idTokenValidity: Duration.minutes(5),
      accessTokenValidity: Duration.minutes(5),
      refreshTokenValidity: Duration.minutes(60),
    })

    // One table for all data, keyed by PK and SK.
    const table = new dynamodb.TableV2(this, 'Table', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: 'expiresAt',
      // Documents can be restored to any second of the last 35 days.
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
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
      entry: API_ENTRY,
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      bundling: { format: nodejs.OutputFormat.ESM, minify: true },
      // A cold start reads the client secret from Cognito before the first sign-in call.
      timeout: Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
      logGroup: new logs.LogGroup(this, 'ApiLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    })

    table.grantReadWriteData(apiFunction)
    userPool.grant(apiFunction, 'cognito-idp:DescribeUserPoolClient', 'cognito-idp:AdminGetUser')

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

    const domain = props?.domain
    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      domainNames: domain && [domain.name],
      certificate:
        domain &&
        acm.Certificate.fromCertificateArn(
          this,
          'Certificate',
          ssm.StringParameter.valueForStringParameter(this, domain.certificateArnParameter),
        ),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
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

    // Two deployments so index.html and hashed assets can get different Cache-Control.
    // Each one excludes the other's files, so pruning never deletes them.
    const assets = new s3deploy.BucketDeployment(this, 'DeployAssets', {
      sources: [s3deploy.Source.asset(WEB_DIST)],
      destinationBucket: bucket,
      exclude: ['index.html'],
      // File names change with content, so a cached copy is never stale.
      cacheControl: [
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(Duration.days(365)),
        s3deploy.CacheControl.immutable(),
      ],
    })

    const index = new s3deploy.BucketDeployment(this, 'DeployIndex', {
      sources: [s3deploy.Source.asset(WEB_DIST)],
      destinationBucket: bucket,
      exclude: ['*'],
      include: ['index.html'],
      // Same name on every deploy, so the browser must revalidate it each time.
      cacheControl: [s3deploy.CacheControl.noCache()],
      distribution,
      distributionPaths: ['/index.html'],
    })
    // New index.html must never point at assets that are not uploaded yet.
    index.node.addDependency(assets)

    new CfnOutput(this, 'Url', { value: `https://${domain?.name ?? distribution.distributionDomainName}` })
    // Target of the DNS record that points a custom domain at the distribution.
    new CfnOutput(this, 'DistributionDomain', { value: distribution.distributionDomainName })
    // Values for api/.env when the API runs locally.
    new CfnOutput(this, 'TableName', { value: table.tableName })
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId })
  }
}
