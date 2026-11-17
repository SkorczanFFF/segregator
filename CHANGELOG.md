# Changelog

The minor version marks a stage of the build plan and the patch version each step or fix within it, as [Semantic Versioning](https://semver.org/spec/v2.0.0.html) allows before 1.0.0. Each entry starts with the version and its commit message, followed by a description of what changed.

## 0.13.4 - fix: describe what the app does today on the entry pages

Released 2026-11-17.

- The panel beside sign-in and sign-up says what Segregator does now: it finds the document in the photo, cuts it out of the background and straightens it, and AI reads the issuer, the amount and the dates for you to check and save. Reminders, which come later, are no longer promised.
- The sample read from a receipt shows the issuer, the amount, the document's date and its type, without a warranty date, since a receipt has none.
- The headline keeps every deadline at hand rather than on time.

## 0.13.3 - feat: redesign the logo as a binder's spine

Released 2026-11-17.

- The logo's mark is a binder's spine: a saffron label at the top and the round hole for a finger below, cut out so the ground shows through. It stands on the name's baseline as tall as its capitals, so it reads as the word's first letter.
- The name is in the deep purple of the brand, light on the dark scheme. On the purple panel of the entry pages the mark turns saffron.
- The browser tab's icon is the same spine, lighter on a dark browser.
- The large faint folders behind the pages and on the entry pages' panel are the spine now too, in one color with its label and hole cut out.

## 0.13.2 - fix: refresh the logo and other fixed-name files on deploy

Released 2026-11-17.

- Only the files under assets/, whose names carry a hash of their content, are cached for a year. The logo and any other file with a fixed name are revalidated like index.html, and each deploy clears them from CloudFront, so a changed logo shows at once.

## 0.13.1 - feat: show the AI readings left on the account page

Released 2026-11-17.

- The account page shows how many readings with AI are left this month, out of the limit, with a bar and what counts as a reading. When reading is closed for the whole app until the month ends, it says so.

## 0.13.0 - feat: move the phone menu to the bottom and stamp the main actions

Released 2026-11-17.

- On a phone a bar at the bottom of the screen takes the place of the menu button: Documents, Add and Account. Add stands up out of the bar, so the floating add button is gone.
- On a phone the account page holds the language, the color scheme and signing out of this device.
- On a wider screen the header holds only the logo. The email and a quiet Sign out sit at the bottom of the side menu, under the language and the color scheme, and the open page in the menu looks like the amount's tag.
- The main action of a screen (Add document, Send for processing, Read with AI, Save) has a solid offset shadow like the amount's tag, and sinks into it when pressed.
- Each month in the list is the tab of a binder's divider, joined to the top of its card, with the year beside it.
- The document types are tiles with the icon over the name, four in a row, so they take two rows.
- The form's buttons sit in a bar at the bottom of the card. On a phone the bar stays at the bottom of the screen, so saving is always at hand.

## 0.12.3 - fix: show amounts with two decimals

Released 2026-11-17.

- The amount field always shows two decimals, e.g. 20,80 instead of 20,8, whether it was typed with a dot or a comma, pasted, read by AI or saved before. It matches the amount on the card.

## 0.12.2 - feat: read a document's fields with AI

Released 2026-11-17.

- Once the file is approved, "Read with AI" fills in the type, subcategory, issuer, amount, date and due date from the version chosen. Each field it fills is marked AI until changed, and nothing is saved before Save.
- A saved document can be read again. Only the fields that change are marked, each with the value it had.
- While the model reads, the fields wait and the file shows "AI is reading the document…" under the sweeping band. A reading takes a few seconds.
- Each account has 100 readings a month and the app 2000 in all, and the panel shows how many are left. A failed reading counts too. A PDF of more than one page, or a month's limit used up, leaves the fields to be entered by hand.
- Behind the scenes, the API counts the reading against both limits in one transaction and queues it for a reader function. The reader sends the file to Amazon Nova 2 Lite on Bedrock through Converse, with one tool the model must call. Each field of the answer is checked by the document's own rules: a subcategory outside the list or a due date on a receipt is dropped, and an answer with only the type fails. The model has no other tool, a PDF goes under a fixed name, and only token counts reach the logs. IAM lets the reader call this one model, and only through its EU inference profile. The limits live in Parameter Store.

## 0.12.1 - feat: add a due date to documents

Released 2026-11-17.

- A document other than a receipt can keep a due date, named for its type: pay by for an invoice or a bill, valid until for a policy, warranty until for a warranty, in force until for a contract. A receipt has none, since the length of a warranty isn't printed on it.
- The due date shows in the document's description on the list and on its card.
- Behind the scenes, the API turns away a due date on a receipt.

## 0.12.0 - feat: animate the photo while it is processed

Released 2026-11-17.

- While a photo is processed, it dims and a band of light sweeps down it, with "Finding the sheet and straightening it…" in a corner. A PDF shows "Checking the file…", and while a file is sent its preview shows the percent sent.
- With reduced motion set in the system, the band stands still.
- The loupe and the full-size viewer wait until the processing ends.
- Each new stage of a new document, from sending to the fields, starts at the top of the page, so on a phone the photo and the next step come into view.
- Until a document's image has loaded, its preview shows a placeholder in its place.

## 0.11.2 - feat: keep older files cheaply and recoverable for 35 days

Released 2026-11-17.

- After 90 days a file moves to S3 Glacier Instant Retrieval, about a fifth of the price, and still opens at once. Files under 128 kB stay where they are, since that class bills each file as at least 128 kB.
- The documents bucket keeps versions. A deleted file stays recoverable for 35 days, as long as the table can be restored, so a restored document still has its file. After that its older version is deleted for good.

## 0.11.1 - feat: give each account 500 MB for files

Released 2026-11-17.

- Each account keeps up to 500 MB of files, counted as they were sent. A draft counts from the moment its upload is signed, so several uploads at once can't slip past the limit. A file that would not fit is turned away before it is sent, with a message to delete documents no longer needed.
- The account page shows how much of the space the files take.
- Behind the scenes, the upload declares the file's size, and the signed form lets S3 take no more than that, so the limit holds to the byte. The used space is summed from the account's documents on each upload.

## 0.11.0 - feat: turn away a file the account already has

Released 2026-11-17.

- A file already among the account's documents is turned away before it is sent, with a link to the document that has it. The check compares the SHA-256 of the file as picked, so the same photo or PDF is recognised from any device, whatever the browser does to it before sending. Documents saved before this version have no hash and are not compared.
- Only saved documents hold their file, so a draft left behind or cancelled never stands in the way, and deleting a document frees its file.
- Behind the scenes, saving the fields writes the hash as an item of its own in the same transaction, on condition that no other document holds it. Two tabs saving the same file at once keep only one document.

## 0.10.3 - fix: close the gaps found in a review of the whole code

Released 2026-11-17.

- A file that reaches the bucket after its document was deleted, for example a photo still on its way, is deleted too instead of staying behind.
- The API saves the fields of a changed photo only once a version is chosen, and an expired draft can no longer be saved or changed.
- A photo whose processing keeps failing or running out of time goes on unchanged on its last try, so its document never waits in processing until the draft expires. A straightened photo that can't be encoded falls back to the original as well.
- Leaving the new document page during an upload stops it and deletes the draft. The page asks for the draft only while it is in processing, and a passing error no longer unlocks the fields.
- A saved document opens straight from the list, and a deleted one is no longer shown from memory when going back.
- Turning or changing a photo waits until the previous turn is ready, so no turn gets lost.
- When the session ends, for example after signing out everywhere on another device, the app goes back to the entry page instead of showing an error on every screen.
- The code field is read out with its label and its error, and a wrong code gets the focus like any other field. A screen reader hears whether each password requirement is met, and no longer every percent of an upload.
- The confirmation screen no longer shows "code sent" beside a failed resend, checks the address before sending a new code, and says how long the code is valid only once. The address fields accept exactly what the API accepts.
- Behind the scenes, the API may only put, show and delete files, without listing the bucket, and the table is protected from deletion. The sign-in rules, Google's addresses, the table's TTL attribute and key prefix, and the runtimes the pipeline builds with each live in one place for the web app, the API and the stack. Dependabot also updates the Python libraries, and a failing batch of expired drafts is split to find the record at fault.

## 0.10.2 - feat: approve the processed photo before the fields

Released 2026-11-17.

- A new document with a photo goes step by step: file, processing, details. The photo is sent as soon as it is accepted, and the page shows the upload with its progress, then the processing. The processed version and the original follow under a switch, to approve the processing, keep the original or pick another photo. The fields open only after that choice. A photo that needed no fixing and a PDF skip the comparison.
- The sheet is found on more backgrounds: a cloth with a bright print, dots or a grid, and a table lit from one side. Preprocessing tries it by brightness, by whiteness and by its edge, keeps what sticks to the sheet off its outline, and takes the outline with the clearest edge.
- A saved document shows both versions of a processed photo, and the version in use can be swapped.
- A click or a tap on any preview opens the image full size, on a phone across the whole screen. Where a photo has two versions, the viewer has the same switch as the page.
- Until its fields are saved, a document with a photo is a draft. A draft stays off the list, a reload during processing comes back to the same step, and Cancel deletes it at once. A draft nobody saves is deleted with its files after 24 hours.
- The list no longer shows upload statuses, since a saved document always has a checked file.
- Behind the scenes, preprocessing writes what it did into the processed copy's metadata, and the worker keeps it with the document. A DynamoDB stream passes expired drafts to a Lambda that deletes their files.

## 0.10.1 - feat: straighten photos of documents before they are read

Released 2026-11-17.

- Before a photo is checked, a Python function finds the document on it. When the whole sheet is on the photo, it is cut out and seen straight from above. Otherwise the lines of text are levelled and their left edge stood upright, which undoes a slight turn and a sideways lean. The straightened copy is kept beside the original, which stays as it was sent, and a PDF goes on unchanged.
- A photo is decoded only when its first bytes match its type, and only up to 25 megapixels.
- Deleting a document deletes its straightened copy too.
- A document whose file gets stuck on the way leaves the list after 15 minutes, as before, but is kept for 30 days and comes back once its file goes through.
- Behind the scenes, uv manages the Python code. Its libraries are pinned with hashes and at least a week old, and the checks run its tests and linter.

## 0.10.0 - feat: check uploaded files in the background

Released 2026-11-17.

- A new document with a file is saved before its file is sent, so closing the tab right after the upload loses nothing. A document whose file never arrives leaves the list after 15 minutes.
- Each uploaded file is checked in the background: its content has to match its type, and a PDF's pages are counted on the server. Until then the list and the document show "Checking", and they refresh by themselves.
- A file that is damaged or of another type than declared is marked with a file error, and its document says how to add it again.
- Behind the scenes, S3 puts every new file on an SQS queue that a separate Lambda reads one message at a time. A file that fails five checks moves to a dead-letter queue, and a duplicate event never checks the same file twice. An edit no longer replaces what the check found.

## 0.9.6 - fix: keep an edit from bringing back a deleted document

Released 2026-11-16.

- Saving a document that was deleted at the same moment, for example in another tab, no longer brings it back. The save ends with "not found", so the document can't point at a file that is gone.

## 0.9.5 - feat: redesign the entry pages and the document's fields

Released 2026-11-16.

- The entry and sign-in pages show a photo of a receipt beside what the app reads from it, with the steps in saffron. The forms sit on a card.
- A document's fields form a card whose top shows the document as it is filled in: the type's icon and color, the name and the category, with the amount on a tag at its lower edge.
- Type and subcategory are picked with buttons instead of drop-down lists, and the fields are grouped into sections. Each type has its own color: a clear tint in the dark scheme, a pastel in the light one, and Save in a deep shade of it with white text, all with WCAG AA contrast. On a new document the photo icon and the main file button take the type's color too.
- Buttons, links, fields and list rows change on hover with a 300 ms transition.
- A link above the title leads back to the documents list, and a saved document shows when it was added.
- The documents list shows each date as day and month under the amount, since the month heads its group, and a paperclip on the type's icon marks a document with a file. On a phone the add button floats in the bottom corner.
- Receipts and invoices can be filed under home appliances too.
- While a document is saving its fields are locked, so nothing changes after it was sent.
- Saving again after a failed save sends the file only once, and a PDF over 10 MB is refused before it is read.
- Behind the scenes, the length of a code, the shortest password and the PDF type each come from one place, and the screens share their decoration and shadow.

## 0.9.4 - feat: give the app its own look and sign out from the header

Released 2026-11-16.

- Saffron joins the purple as a second brand color, kept for small accents. The logo is a purple binder with a saffron label, also used as the favicon.
- Sign out, in red, sits on the right of the header next to the email address. The account page keeps signing out on all devices, also in red.
- Language and color scheme sit at the bottom of the side menu, each as a switch that shows all its options, and the color scheme can also follow the device. On a phone a saffron menu button on the right opens the side menu, which then also holds the email and sign out.
- The documents list groups documents by month and shows each type with its own icon and color, with a paperclip on those that have a file.
- Dialogs, such as the one confirming a delete, have their normal, smaller padding.
- A large faint folder sits in the corner behind the pages.

## 0.9.3 - feat: prepare the file in the browser and show it beside the fields

Released 2026-11-16.

- A new document starts with its file: drop a photo or a PDF on the page, choose one, or on a phone take a photo right away. The fields sit beside the file, on a saved document too.
- The browser turns a photo upright by its EXIF data, shrinks it to 2560 px on the longer side and saves it again as JPEG, which also drops the location a phone may have saved in it. Buttons turn it by 90°.
- A PDF shows its first page through pdf.js, which loads only once a PDF is picked, with a note when it has more pages.
- A file that can't be opened, such as a PDF with a password, or a PDF over 10 MB is refused before anything is sent.
- With a mouse, a loupe enlarges the part of the image under the cursor.

## 0.9.2 - feat: show the document's file

Released 2026-11-16.

- The document page shows the photo above the fields, and Open file opens the photo or PDF in a new tab.
- The API answers the file's address with a link to S3 that works for five minutes, and only for the document's own account.

## 0.9.1 - refactor: clean up shared rules, validation and setup leftovers

Released 2026-11-16.

- The entry page no longer offers a demo whose button led nowhere. The demo comes back with the public launch.
- Error messages take their limits from the same constants as the checks, such as the longest name and the highest amount.
- Behind the scenes, api and web share limits, error codes and response types, and the API checks every JSON body in one place.

## 0.9.0 - feat: attach a file to a new document

Released 2026-11-16.

- A new document can come with a JPEG or PNG photo or a PDF of up to 10 MB. The browser sends it straight to S3 with a form the API signs, and a bar shows the progress.
- The document is saved only once S3 holds the file, and one file belongs to one document.
- Files sit in a private bucket encrypted with a key of their own, and deleting a document deletes its file.
- The document page shows the file's type and size.

## 0.8.3 - fix: end Cognito's own session right after a Google sign-in

Released 2026-11-16.

- A Google sign-in no longer leaves a session in Cognito. That session let the next Continue with Google in the same browser skip Google, even after signing out of Segregator.
- On the way to the documents list the browser passes through Cognito's sign-out, so Segregator's own session is the only one.

## 0.8.2 - fix: send a new code only to an unconfirmed account

Released 2026-11-15.

- A confirmation code goes only to an account that isn't confirmed yet. Cognito would also send one to a confirmed account, where it can't be used and only takes an email from the daily limit.
- This covers sign-up with a taken address and requests for a new code.

## 0.8.1 - feat: sign in with Google

Released 2026-11-15.

- Continue with Google signs in through Cognito's Google provider, with PKCE and a state cookie, and the API starts its own session as after a password sign-in.
- A first Google sign-in with the address of a confirmed account joins that account, so both ways lead to the same documents.
- A password sign-up with an address that already signs in with Google gets the same answer as any taken address.
- Sign-up closed to a list of addresses applies to Google too, and the sign-in screen explains a failed Google sign-in.

## 0.8.0 - feat: close sign-up to a list of addresses on demand

Released 2026-11-15.

- Sign-up stays open to anyone, but a Parameter Store setting can limit it to listed addresses at once, without a deploy.
- A Cognito Pre sign-up trigger checks every new account against that setting before Cognito creates it.
- An address outside the list gets a message on the sign-up screen.

## 0.7.5 - feat: add invoices as a document type

Released 2026-11-15.

- Invoice is a document type of its own, listed right after Receipt and sharing its subcategories, from fuel to electronics.

## 0.7.4 - feat: edit and delete documents

Released 2026-11-13.

- Each document on the list opens its own page with the same form, filled in, to change and save it.
- A document can be deleted after a confirmation.
- `GET`, `PUT` and `DELETE /api/documents/:id` reach only the signed-in account's documents. Any other id, including another account's document, gets 404.
- Signed-in pages sit centered in the main area instead of along its left edge.

## 0.7.3 - feat: add documents by hand

Released 2026-11-13.

- The documents page has an Add document button. Its form takes the type, a subcategory that follows the type, the issuer, an optional name and amount, and the date on the document, picked from a calendar and set to today.
- The form checks the fields with the same Zod schema as the API, and each field shows its own message in the chosen language.
- The amount accepts a comma or a dot and is sent in grosze.
- The documents list loads through TanStack Query and refreshes after a save. Requests are retried only after a lost connection, so an answer such as 404 shows at once. Signing out clears all loaded data.
- Text, list, number and date fields share one size, including the email field on the sign-in and sign-up screens.

## 0.7.2 - fix: color the password meter and messages by meaning

Released 2026-11-13.

- The password strength meter runs from red for a very short password through orange and yellow to green for a long one.
- Met password requirements get a green tick.
- Errors are red, warnings orange and confirmations green, each with its own icon, so the meaning never rests on color alone.
- The Caps Lock note is orange.
- In light mode, red, orange and green text uses darker shades so it keeps 4.5:1 contrast.
- In dark mode, red, orange and green buttons and alert icons use lighter shades of their own color.

## 0.7.1 - feat: add the signed-in layout and the documents list

Released 2026-11-13.

- After signing in, the app opens in a layout with a header and a side menu with Documents and Account. On a phone the menu opens from the header.
- The documents page lists the account's documents newest first: the date on the document, the title or issuer, the category and the amount, 50 at a time with a button for older ones. It has loading, error and empty states.
- Amounts and dates follow the chosen language: 286,45 zł and 11 lis 2026 in Polish, PLN 286.45 and Nov 11, 2026 in English.
- The account page is part of the new layout.
- Category names are translated, and TypeScript checks the translations against the shared category list.

## 0.7.0 - feat: store documents and list them newest first

Released 2026-11-13.

- Added the `shared` package with the document categories and the document schema in Zod, used by the API now and by the web app next.
- Added `POST /api/documents` and `GET /api/documents`. Every key starts from the signed-in account, so one account can never read another's documents.
- A document has a type and subtype from the category list, an issuer, an optional title and amount, and the date on the document. Amounts are whole grosze, so sums never round.
- Documents get ULID ids and are listed by the date on the document, newest first, 50 per page. A cursor fetches the next page, and a cursor that points outside the account's list is rejected.
- The table keeps point-in-time recovery for the last 35 days.

## 0.6.4 - feat: serve prod from segregator.skoftware.pl

Released 2026-11-13.

- The prod web app and API answer on `https://segregator.skoftware.pl`. Dev keeps its CloudFront address.
- The certificate comes from ACM in us-east-1, as CloudFront requires, and the stack reads its ARN from Parameter Store.
- Each stack outputs its CloudFront domain, the target for the domain's DNS record.

## 0.6.3 - feat: harden sessions and sign-in requests

Released 2026-11-13.

- Writes that a page on another site can send without CORS, such as a form post, are rejected with 403. Hono's `csrf()` checks the `Sec-Fetch-Site` header browsers add, together with `Origin`.
- `POST /api/auth/*` has a stricter limit of its own: 1 request per second with bursts of 5. `GET /api/auth/me`, which every page load calls, stays on the general limit.
- The account page can sign out on all devices through the new `/api/auth/logout-all` endpoint.
- Setting a new password ends every session of that account.
- Sessions are listed per user in the table's new `GSI1` index, which documents will share.
- A throttled request shows "Too many attempts" in the web app.

## 0.6.2 - feat: redesign sign-in and sign-up screens

Released 2026-11-12.

- The sign-in screens now sit beside a purple brand panel with the app's promise, a sample receipt and the three steps of using it. On a phone the panel shrinks to a header.
- Google sign-in comes first, with email below an "or with email" divider. Links between sign-in and sign-up moved under the title.
- A field with something typed in is checked when it loses focus, so leaving an empty field shows no error. Errors clear while typing, sending checks every field, and a failed send moves focus to the first wrong one. An empty email asks for the address instead of calling it invalid.
- A new password shows a live strength meter, a character count and its requirements: 12 characters, no spaces at either end and not containing the email address. Requirements tick as they are met and turn red only after the field fails.
- The email field on sign-up suggests common domains as the address is typed.
- Password fields warn when Caps Lock is on.
- The confirmation screen takes the code in six boxes that accept pasting and send the form after the last digit. It shows where the code went, links back to change the address and offers a new code after 45 seconds through the new `/api/auth/resend-code` endpoint.
- Sign-up and confirmation show their step, 1 of 2 and 2 of 2.
- Text, muted text, field borders and error text now meet WCAG contrast in both themes, and the light variant in dark mode sits above the card surface.

## 0.6.1 - feat: add password reset by email code

Released 2026-11-12.

- Added `/api/auth/forgot-password` and `/api/auth/reset-password`. Asking for a code always answers the same way, also for an unknown or unconfirmed address, so the form does not reveal who has an account.
- Added a "Forgot your password?" link on the sign-in screen and two screens: one asks for the address, the other takes the code and the new password.
- After the password changes, the sign-in screen opens with the address filled in and a confirmation message.
- Sign-up and reset share the same new password rules.

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
