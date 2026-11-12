# Segregator

Segregator takes a photo or PDF of a document, straightens the image, reads the data with AI and lets you check it. Then it files the document into categories and reminds you of deadlines by email. Work in progress.

## Repository

- `web/`: React front end (Vite, Mantine)
- `api/`: Hono API, deployed as an AWS Lambda function
- `infra/`: AWS CDK app stack and the CodePipeline that deploys it to `dev` and `prod`

## Local development

The web app runs on Vite and the API runs as a plain Node.js process. There is no local database: users, sessions and data live in the Cognito user pool and DynamoDB table of the deployed `dev-Segregator` stack.

```
browser → Vite (localhost:5173) ── /api ──▶ Hono on Node.js (127.0.0.1:3000) ──▶ Cognito + DynamoDB (dev stack)
```

You need Node.js 24, pnpm (the version in `packageManager`), AWS CLI v2 and access to the AWS account with the dev stack.

1. Install dependencies and sign in to AWS. The local API uses these credentials.

   ```sh
   pnpm install
   aws login
   ```

2. Copy the example config. Git ignores `api/.env`.

   ```sh
   cp api/.env.example api/.env
   ```

3. Read the dev stack outputs and paste `TableName`, `UserPoolId` and `UserPoolClientId` into `api/.env` as `TABLE_NAME`, `USER_POOL_ID` and `USER_POOL_CLIENT_ID`:

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
- The session cookie is `__Host-session` with `Secure`. Chrome and Firefox accept it on `http://localhost`.
- When the dev stack is recreated, its outputs change, so `api/.env` needs the new values.
