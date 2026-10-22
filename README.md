# Axiis

One place where your tasks, time and notes meet. See `PRODUCT.md` for purpose and brand, `CONTEXT.md` for vocabulary, `docs/data-model.md` for the data shape and `docs/adr/` for decisions.

## Develop

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase URL and publishable key; the rest may stay blank
npm run dev
```

Checks, which CI also runs:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Browser tests

`e2e/` holds Playwright tests. They cover the signed-out pages and redirects, the signed-in routes through a fake session compiled only into the browser-test build (`docs/e2e-session.md`), the dev harness pages under `/dev`, and axe accessibility checks in light, dark and at phone width, failing on serious or critical issues.

```bash
npm run e2e                      # uses your installed Google Chrome
E2E_CHANNEL=msedge npm run e2e   # or Microsoft Edge, e.g. on Windows
npx playwright test e2e/a11y.spec.ts -g dark   # one file, or tests whose title matches
```

Playwright builds the app with `AXIIS_E2E_BUILD=1` and serves it with `next start` on port 3600, with placeholder Supabase values and a fresh session secret per run. It never reuses a running server and does not download its own browsers. CI runs the suite after the checks job and uploads the report when it fails.

## Supabase project

1. Create a project at supabase.com. In Project Settings, API Keys, copy the project URL and the publishable key into `.env.local`. Never put the service-role or secret key in `.env.local` or in the repository.
2. Apply the schema: every file in `supabase/migrations/`, in order, in the SQL editor, or link the CLI (`npx supabase link`, then `npx supabase db push`).
3. In Authentication, URL Configuration, set the site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect URLs. Enable the Email provider, and Google if you want it.

Database behaviour (schema, constraints, Row Level Security) is tested without Docker against PGlite. Check changes against a hosted project before releasing.

## Deploying and security

The production steps, in order, are in `docs/launch-checklist.md` (Non-negotiables, then the Deploy runbook). To report a vulnerability, see `SECURITY.md`.

## Prototype

`prototypes/today-score/index.html` is the throwaway Today view that settled the visual direction. Open it with any static server.
