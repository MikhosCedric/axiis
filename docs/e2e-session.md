# Browser tests on the signed-in routes

The e2e suite visits the real signed-in routes (`/today`, `/day/...`, `/week`, `/inbox`, `/lists`, `/tags`, `/notes`, `/search`, `/settings`) with the real proxy, layouts, nav rail and server actions. It does this without the magic link and without any Supabase account, through a fake session that exists only in `next dev`.

## The guard

`src/lib/supabase/fake-session.ts` is the only place that decides whether a request has the fake session. `isFakeSession` returns true only when every one of these holds:

1. `process.env.NODE_ENV === "development"`, written as that literal so Next inlines it.
2. `E2E_FAKE_SESSION` is exactly `"1"`.
3. `VERCEL` is unset.
4. `E2E_FAKE_SESSION_SECRET` is at least 32 characters.
5. The request's `axiis-e2e-session` cookie equals that secret, compared in constant time.

There is no default secret, and no query string or header route in. When the guard says yes:

- The proxy treats the request as signed in.
- `getItemsRepo`, `getNotesRepo` and `getAreasRepo` return in-memory repos from `src/lib/supabase/fake-account.ts`, seeded with fixtures for the user `e2e@axiis.invalid`.
- The settings page shows that email, the export route reads the in-memory rows, and deleting the account resets the fixtures.
- The landing page sends the user to `/today`, and sign-out clears the cookie.

Everything else takes the unchanged production path. The proxy still runs `updateSession` first, which builds a Supabase client and asks for claims. With no Supabase cookie in the browser it finds no session, and the dev server points at the unused placeholder `http://localhost:54321`, so no real Supabase project is ever contacted.

The guard's tests are mutation-checked: removing or weakening any condition above fails them. One mutation no black-box test can catch is a non-empty default secret, since a test cannot guess it. Review keeps that out: the secret reads `process.env.E2E_FAKE_SESSION_SECRET ?? ""`, and the 32-character floor rejects the empty fallback.

`POST /dev/e2e-session` resets the fixtures. It answers 404 without the fake session. The e2e warm-up calls it once per run.

## Why production cannot reach it

Every function body in `fake-session.ts` sits inside `if (process.env.NODE_ENV === "development")`. A production build inlines `"production"` there, so the bundler drops the branch, the cookie name, the env names and the dynamic import of `fake-account.ts`.

`npm run check:no-fake-session` proves this on the real output. It builds with the CI placeholder env, then searches every file under `.next/server` and `.next/static`:

- for the guard's own strings (`E2E_FAKE_SESSION`, `axiis-e2e-session`), in every built file except source maps;
- for the fixtures (`e2e@axiis.invalid`, the fixture id prefix), in every file including source maps.

It also checks that a known production string is present, so an empty build cannot pass. CI runs it after `npm run build` in the `check` job, with `--skip-build`. Server source maps do contain `fake-session.ts` as original source text, which never runs. That is why the guard's strings are not searched in `.map` files.

Unit tests in `src/lib/supabase/fake-session.test.ts` cover each missing condition. `src/proxy.test.ts` shows that a request with the right cookie but no `E2E_FAKE_SESSION` is sent to `/login`.

## Running it

```bash
npm run e2e                     # Chrome
E2E_CHANNEL=msedge npm run e2e  # Edge, on Windows
```

`playwright.config.ts` makes a fresh random secret per run, passes it to the dev server with `E2E_FAKE_SESSION=1`, and the workers inherit it. `e2e/session.ts` exports `signedIn`, a test whose browser context carries the cookie. The config never reuses a running server, because that server would not hold this run's secret. Stop anything on port 3600 first.

## What it does not cover

The fake session replaces Supabase, so these stay untested by the browser suite:

- Supabase Auth itself: the magic link, Google sign-in, the callback, session refresh.
- Row level security and the real PostgREST queries. `SupabaseItemsRepo` and the other Supabase repos never run in these tests.
- The real `delete_my_account` RPC and the real export reads.

The unit tests, the PGlite database tests and the owner's signed-in pass still cover those.
