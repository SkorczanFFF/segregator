# Changelog

Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each entry starts with the version and its commit message, followed by a description of what changed.

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
