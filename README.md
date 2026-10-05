# Axiis

One place where your tasks, time and notes meet. See `PRODUCT.md` for purpose and brand, `CONTEXT.md` for vocabulary, `docs/data-model.md` for the data shape and `docs/adr/` for decisions.

## Develop

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev
```

Checks, which CI also runs:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Supabase project

1. Create a project at supabase.com. In Project Settings, API, copy the project URL and the `anon` public key into `.env.local`.
2. Apply the schema: paste `supabase/migrations/0001_core.sql` into the SQL editor, or link the CLI (`npx supabase link`, then `npx supabase db push`).
3. In Authentication, URL Configuration, set the site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to the redirect URLs. Enable the Email provider, and Google if you want it.

Database behaviour (schema, constraints, Row Level Security) is tested without Docker against PGlite. Check changes against a hosted project before releasing.

## Prototype

`prototypes/today-score/index.html` is the throwaway Today view that settled the visual direction. Open it with any static server.
