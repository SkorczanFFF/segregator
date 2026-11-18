# Segregator

Segregator takes a photo or PDF of a document, finds the document in the photo, cuts it out and straightens it. On request AI reads its type, issuer, amount and dates, which you check before saving. Documents are kept by type and month, with their due dates. Reminders of deadlines by email come next. Work in progress.

Live at [segregator.skoftware.pl](https://segregator.skoftware.pl).

## Repository

- `web/`: React front end (Vite, Mantine)
- `api/`: Hono API, the worker that checks uploaded files, the reader that fills a document's fields with a model on Amazon Bedrock, the cleanup of abandoned drafts and the Cognito trigger that guards sign-up, each deployed as an AWS Lambda function
- `preprocess/`: Python function that straightens photos of documents with OpenCV, managed with uv
- `demo/`: Python script that draws the read-only demo's fictional documents as phone photos and straightens them with `preprocess/`, also with uv
- `shared/`: Zod schemas, the category list and the file, auth and table constants used by the API, the web app and the stack
- `infra/`: AWS CDK app stack and the CodePipeline that deploys it to `dev` and `prod`

## Local development

The web app runs on Vite and the API runs as a plain Node.js process. There is no local database: users, sessions, data and files live in the Cognito user pool, DynamoDB table and S3 bucket of the deployed `dev-Segregator` stack.

```
browser → Vite (localhost:5173) ── /api ──▶ Hono on Node.js (127.0.0.1:3000) ──▶ Cognito + DynamoDB + S3 (dev stack)
```

You need Node.js 24, pnpm (the version in `packageManager`), uv (the version `preprocess/pyproject.toml` requires), AWS CLI v2 and access to the AWS account with the dev stack. uv brings its own Python, and `pnpm cdk synth` uses it to bundle the Python function for Linux on arm64 without Docker.

1. Install dependencies and sign in to AWS. The local API uses these credentials.

   ```sh
   pnpm install
   aws login
   ```

2. Copy the example config. Git ignores `api/.env`.

   ```sh
   cp api/.env.example api/.env
   ```

3. Read the dev stack outputs and paste `TableName`, `UserPoolId`, `UserPoolClientId`, `CognitoDomain`, `DocumentsBucketName`, `ReadQueueUrl` and `ReadLimitsParameter` into `api/.env` as `TABLE_NAME`, `USER_POOL_ID`, `USER_POOL_CLIENT_ID`, `COGNITO_DOMAIN`, `DOCUMENTS_BUCKET`, `READ_QUEUE_URL` and `READ_LIMITS_PARAMETER`:

   ```sh
   aws cloudformation describe-stacks --stack-name dev-Segregator --query "Stacks[0].Outputs" --output table
   ```

4. Start both servers and open http://localhost:5173:

   ```sh
   pnpm dev
   ```

   Vite reloads the page on front-end changes, and `node --watch` restarts the API when its code changes. Restart `pnpm dev` after editing `api/.env`.

### Good to know

- Everything done locally is real dev data. Signing up creates a user in the dev pool and sends a real confirmation email. Cognito's default sender allows 50 emails a day per AWS account.
- The local API acts with your own AWS credentials, not the Lambda role. A permission missing from the stack works locally and fails only after deployment, so check new AWS calls on dev as well.
- The Cognito client secret is read from Cognito at startup and never goes into `.env`.
- The API listens on `127.0.0.1` only, because it holds your AWS credentials.
- Files go straight from the browser to the dev documents bucket, which accepts uploads from `http://localhost:5173`. The dev stack's queues and functions then straighten and check them, so a document added locally shows its status changing like on dev.
- The session cookie is `__Host-session` with `Secure`. Chrome and Firefox accept it on `http://localhost`.
- When the dev stack is recreated, its outputs change, so `api/.env` needs the new values.

## Tests

The data layer tests run against DynamoDB Local in Docker and create and delete their own table. `pnpm test` also runs the Python tests with uv, on documents drawn in code:

```sh
docker run --rm -d -p 8000:8000 --name dynamodb-local amazon/dynamodb-local:3.3.2
pnpm test
docker stop dynamodb-local
```

CI runs them against the same image as a service container.
