# Tailspin Toys

Tailspin Toys is a crowdfunding platform for games with a developer theme. The project is a website for a fictional game crowd-funding company, built as a single [Astro](https://astro.build/) site (fully prerendered/static output) styled with [Tailwind CSS](https://tailwindcss.com/). Its data lives in a local SQLite database accessed through [Drizzle ORM](https://orm.drizzle.team/) and Node.js's built-in SQLite driver; pages query the database directly in frontmatter at build time, so there is no separate backend service.

## Architecture

- **Astro 7** — pages, layouts, components, and routing. `output: 'static'`, so the whole site is prerendered to HTML at build time.
- **Drizzle ORM + Node SQLite** — the data layer. The schema lives in `db/schema.ts`; data is seeded from `db/games.csv`. Migrations are managed with `drizzle-kit`.
- **Tailwind CSS v4** — styling via utility classes (dark theme).
- **React islands** — hydrated browser-local tools (`/devbrief` and `/url-cleaner`) for stateful interactions.
- **Vitest** — unit tests for the data layer and pure transforms.
- **Playwright** — end-to-end tests run against the built static site.

The database is migrated and seeded automatically before `dev`/`build` (via the `predev`/`prebuild` npm scripts) and is written to the gitignored `tailspin.db` file.

## Using this template

This repository is a GitHub template. When you create a new repository from it, a one-time **Bootstrap template issues** workflow (`.github/workflows/bootstrap-issues.yml`) runs automatically on the first push to `main` and opens a set of starter issues describing suggested first features. Each issue is defined by a Markdown file in `.github/bootstrap-issues/` — the first heading becomes the issue title and the remaining content becomes the body — so you can edit, add, or remove files there to control which issues are created.

The workflow only runs on repositories created from the template (the `if: ${{ !github.event.repository.is_template }}` guard skips the template itself), and after creating the issues it removes itself and the `.github/bootstrap-issues/` folder in a cleanup commit so it never runs again.

## Getting started

Install dependencies once with Node.js 22.13 or later:

```bash
npm ci
npx playwright install chromium   # only needed to run the E2E tests
```

## Launch the site

```bash
npm run dev
```

`predev` migrates and seeds the local database first. Then navigate to the [website](http://localhost:4321) to see the site!

To preview a production build instead:

```bash
npm run build      # prebuild migrates + seeds, then builds the static site
npm run preview
```

## Database

The SQLite database is built from `db/games.csv` — there is no live data to migrate.

```bash
npm run db:generate   # generate a migration after editing db/schema.ts
npm run db:migrate    # apply migrations
npm run db:seed       # seed from games.csv (idempotent)
npm run db:setup      # migrate + seed (run automatically by predev/prebuild)
```

> [!NOTE]
> Seeding is idempotent — it skips games that already exist (matched by title) rather than reconciling changed rows. CI always starts from a clean database, so it reflects `games.csv` exactly. Locally, if you edit or remove rows in `games.csv`, delete `tailspin.db` and re-run `npm run db:setup` to fully regenerate.

## Running tests

```bash
npm run test:unit   # Vitest unit tests (transforms + data-access helpers)
npm run test:e2e    # Playwright E2E tests (builds + previews the static site first)
```

## Linting

The frontend uses ESLint to enforce code quality across TypeScript and Astro files. Run it with:

```bash
npm run lint
```

ESLint is also run automatically in CI on pull requests to `main`.

## Coding standards

Repository-specific guidance is maintained in [`.github/instructions`](./.github/instructions/). In summary, comments should explain intent and decisions rather than restate code, and stale comments should be updated or removed with the related change. Every exported function in `db/` and `src/lib/` needs TSDoc/JSDoc describing its purpose, parameters, and return value, including injectable database arguments. Reusable Astro components document their `Props` interfaces and non-obvious properties. TypeScript follows the existing four-space, single-quote, semicolon, and trailing-comma style; exported APIs use explicit types and `any` is avoided. Run `npm run lint`, `npm run typecheck`, `npm run typecheck:astro`, and `npm run test:unit` before submitting changes.

## Type checking

The project runs on **TypeScript 7** (the native Go compiler, `tsgo`) for type checking, adopted side-by-side via the [`@typescript/native-preview`](https://www.npmjs.com/package/@typescript/native-preview) package. The classic `typescript` package is intentionally kept at v6 so ESLint + `typescript-eslint` and `astro check` keep working unchanged — TypeScript 7's programmatic API isn't ready for those tools yet.

```bash
npm run typecheck        # tsgo (TS 7) type-checks the pure TypeScript (db/, src/lib/, src/types/, configs, tests)
npm run typecheck:astro  # astro sync + astro check type-check .astro files (on the classic TypeScript package)
npm run typecheck:all    # both of the above
```

`tsgo` runs against [`tsconfig.tsgo.json`](tsconfig.tsgo.json), a scoped config that excludes `.astro` files (which the native compiler doesn't understand). Type checking runs automatically in CI on pull requests to `main`.

> [!NOTE]
> The native compiler is used only for type checking (`--noEmit`); the site is still built by `astro build` (Vite/esbuild). The classic `typescript` package stays on v6 until `typescript-eslint` and `@astrojs/check` support the native API (~TS 7.1); a Dependabot `ignore` in `.github/dependabot.yml` holds the classic `typescript@7` bump until then.

## DevBrief

Visit `/devbrief` to turn a rough issue or bug report into a structured development brief with problem, reproduction steps, context, behavior, requirements, acceptance criteria, technical considerations, edge cases, implementation steps, and a testing checklist. Common headings such as “Steps to Reproduce” are preserved in their own section. Start with one of the built-in examples, then copy any section or the full Markdown brief, or download it as a `.md` file.

Briefs are generated by transparent deterministic rules in the browser—**this is not an AI feature**. Issue text is not sent to a server. Recent briefs are stored in browser `localStorage` (up to 20 on this device); clearing browser storage removes them. Press **Ctrl+Enter** (or **⌘+Enter** on macOS) to generate, and **Escape** to clear the issue text.

The feature is a hydrated React island within the existing Astro application. Start the app as usual with `npm run dev`, then open [http://localhost:4321/devbrief](http://localhost:4321/devbrief).

## URL tracking cleaner

Visit `/url-cleaner` to paste a link and review recognized tracking parameters before copying the result. Processing is entirely in your browser; URLs are not sent to a service or saved. The cleaner selects an explicit list of common keys (`fbclid`, `gclid`, `dclid`, `gclsrc`, `gbraid`, `wbraid`, `msclkid`, `twclid`, `ttclid`, `li_fat_id`, `mc_cid`, `mc_eid`, `mkt_tok`, `_hsenc`, `_hsmi`, `igshid`, `yclid`, `gad_source`, `gad_campaignid`, `srsltid`, `epik`, `sscid`, and `si`) plus keys beginning with `utm_`, without regard to case. Unrecognized query parameters are preserved, including repeated parameters, their order, and URL fragments.

This is a small manual helper, not comprehensive tracking protection. It does not maintain domain-specific rules, inspect redirects, or remove unknown parameters; even a recognized key can be functional on a particular site, so review changes before copying.

## Copilot Agents & Skills

This project ships Copilot customizations to assist with quality assurance:

### Database Explorer Canvas

The shared **Database Explorer** canvas (`.github/extensions/database-explorer/`) provides a small UI and agent actions for browsing the project's SQLite tables and running one read-only `SELECT` or `WITH` query at a time. It uses the database at `.data/tailspin.db` (or `DATABASE_URL` when set), so run `npm run db:setup` before opening it in a fresh checkout.

### PR Readiness Agent

The **PR Readiness** agent (`.github/agents/pr-readiness.md`) is a pre-PR quality gate. Invoke it before opening a pull request to:

- Verify all acceptance criteria have been implemented
- Audit test coverage and fill any gaps
- Run the full verification suite (unit tests, lint, E2E tests)
- Manually validate the feature in the browser via Playwright MCP (required for every run)
- Produce a go/no-go report

### quality-checks Skill

The **quality-checks** skill (`.github/skills/quality-checks/SKILL.md`) wraps the project's npm test and lint commands with a detailed debugging and troubleshooting runbook. Use it via `/quality-checks` when:

- Running tests or lint for the first time after setup
- Diagnosing test failures (port conflicts, stale servers, flaky tests, CI divergence)
- Validating readiness before commits, pushes, or merges

### GitHub Copilot App Run Menu

The [GitHub Copilot app](https://github.com/github/github-app) reads
`.github/github-app.yml` to provide project commands in its **Run** menu.
New sessions automatically install dependencies; use **Run development site** to
start Astro. When Astro reports its local URL, the app opens it in the browser
canvas automatically. The menu also provides static build and type-check
commands for on-demand validation.

## License 

This project is licensed under the terms of the MIT open source license. Please refer to the [LICENSE](./LICENSE) for the full terms.

## Maintainers 

You can find the list of maintainers in [CODEOWNERS](./.github/CODEOWNERS).

## Support

This project is provided as-is, and may be updated over time. If you have questions, please open an issue.

## Disclaimer

This app is not intended for use in a production environment, nor is it built as an example of what a production app should look like.
