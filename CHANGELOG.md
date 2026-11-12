# Changelog

Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each entry starts with the version and its commit message, followed by a description of what changed.

## 0.6.0 - feat: add email sign-up and sign-in with server sessions

Released 2026-11-12.

- Added a Cognito user pool on the Lite plan. Email is the username, sign-in ignores letter case, new accounts confirm their address with a code, passwords need at least 12 characters without rules for character types, and the pool has deletion protection.
- Added `/api/auth` endpoints: `register`, `confirm`, `login`, `logout` and `me`. The API calls Cognito through a client with a secret, which the function reads from Cognito when it starts, so the secret is never stored in code or configuration.
- Signing in creates a server session instead of keeping tokens in the browser. The browser only gets a `__Host-session` cookie with `HttpOnly`, `Secure` and `SameSite=Strict`, and the database stores only a SHA-256 hash of the session id. A session ends after 7 days without use or 30 days after signing in.
- Every API route requires a session unless it is marked as public, so a request without one gets 401, also on unknown paths.
- Signing up gives the same answer for a new and a taken address, so the form does not reveal who has an account. An account that is not confirmed yet gets a new code instead.
- Added a DynamoDB table with `PK` and `SK` keys, billed per request. Expired sessions are removed by TTL.
- Added the email confirmation screen and an account page with sign-out. Signed-out users are sent to sign-in, and signed-in users skip the sign-in screens.
- API errors show up in the forms in Polish or English.
- `pnpm dev` now starts the API as well: the same Hono app on a local Node.js server at `127.0.0.1:3000`, with Vite forwarding `/api` to it. It uses the dev stack's Cognito pool and DynamoDB table, whose names the stack now lists as outputs. Setup is described in `README.md`.

## 0.5.0 - feat: deploy through CodePipeline with dev and prod stages

Released 2026-11-11.

- Added a self-updating CodePipeline that builds `main` and deploys it to a `dev` stage, then to `prod` after a manual approval.
- The pipeline pulls the code through a CodeConnections GitHub app, so GitHub holds no AWS credentials. GitHub OIDC is not an option, because the account's AWS-managed service control policy blocks IAM identity providers.
- The single `SegregatorStack` is replaced by `dev-Segregator` and `prod-Segregator`, each with its own CloudFront URL.
- CodeBuild installs `aws-cdk` and `cdk-assets` at the versions from the lockfile instead of the latest release, so the 7-day release age policy covers them too.
- Assets are published by one CodeBuild action and stacks deploy without separate change set actions, which keeps the billed pipeline minutes low.

## 0.4.0 - feat: add Hono API on Lambda behind CloudFront

Released 2026-11-09.

- Added the `api` package: a Hono app on AWS Lambda (Node.js 24, ARM) with a `GET /api/health` endpoint.
- Unknown paths and unexpected errors return JSON error codes (`not_found`, `internal_error`) instead of text, so the web app can translate them.
- Added an API Gateway HTTP API in front of the function. It accepts 5 requests per second with bursts of 10, which caps the cost of a bot or a client-side loop.
- CloudFront serves the API under `/api/*` on the same domain as the web app, so no CORS setup is needed. API responses are never cached, all viewer headers except `Host` are forwarded, and only HTTPS is accepted.
- API logs are kept for 30 days and removed together with the stack.
- Moved esbuild to the workspace root, because CDK bundles the function from there.

## 0.3.0 - feat: deploy frontend to CloudFront with CDK

Released 2026-11-09.

- Added a CDK stack that hosts the web app on CloudFront. `pnpm cdk deploy` uploads the current `web/dist`, so run `pnpm build` first.
- The files live in a private S3 bucket. Only this CloudFront distribution can read it, through Origin Access Control, and any request without HTTPS is denied.
- HTTP requests are redirected to HTTPS.
- Added a CloudFront Function that serves `index.html` for paths without a file extension, so refreshing `/login` or `/register` works.
- Added security headers: a Content Security Policy, HSTS, `nosniff` and a strict referrer policy. Inline styles are allowed because Mantine injects them, while scripts are limited to the app's own files.
- Hashed files in `assets/` are cached for a year. `index.html` is revalidated on every visit and invalidated in CloudFront after each deploy, so a new version shows up right away.
- `cdk destroy` removes the bucket together with its files, so the whole stack can be torn down and recreated from code.

## 0.2.0 - feat: add auth screens with theme and language switch

Released 2026-11-06.

- Added an entry screen with sign-in, sign-up and demo actions.
- Added sign-in and sign-up screens with client-side validation. The forms are not connected to a backend yet, so a valid form is not submitted anywhere.
- Added a Continue with Google button below each form. It has no action yet.
- Added routing with React Router under the language-neutral paths `/login` and `/register`.
- Added a light and dark mode switch. The first visit follows the system setting and the choice is remembered.
- Added Polish and English through i18next. The first visit follows the browser language and the choice is remembered. TypeScript checks that both languages have the same keys, and validation messages change with the language without clearing the form.
- Added Fraunces for headings and Hanken Grotesk for text.
- Organized the web source by feature, with shared code in one place.
- Added the app style in the Mantine theme: gradient buttons with small corner radii, cards on a tinted background, a purple-tinted dark palette and a joined pair of toggles with tooltips.
- Removed all custom CSS and the PostCSS setup. Layout and style now come from Mantine components and the theme.

## 0.1.0 - chore: set up pnpm monorepo

Released 2026-11-06.

- Set up a pnpm monorepo with shared versions, TypeScript and lint configuration at the root.
- Added a web skeleton with Vite, React and Mantine, including the `~/` import alias.
- Added the purple brand theme and JetBrains Mono.
- Added PostCSS with the Mantine preset.
- Added an empty CDK application.
- Added pnpm supply chain policies: a seven-day minimum release age, a trust downgrade check and blocked install scripts.
