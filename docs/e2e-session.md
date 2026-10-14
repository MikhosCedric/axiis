# Browser tests on the signed-in routes

The e2e suite visits the real signed-in routes (`/today`, `/day/...`, `/week`, `/inbox`, `/lists`, `/tags`, `/notes`, `/search`, `/settings`) with the real proxy, layouts, nav rail and server actions. It does this without the magic link and without any Supabase account, through a fake session that exists only in the browser-test build.

## The browser-test build

The suite runs against a production build served by `next start`, not `next dev`. Every route is compiled before the first test, so no test waits on a compile and no Fast Refresh reload drops a page's state.

That build is a normal `next build` with `AXIIS_E2E_BUILD=1` set. `next.config.ts` reads the variable once and:

- inlines `process.env.AXIIS_E2E_BUILD` into the bundle as `"1"`, or as `""` in every other build;
- builds into `.next-e2e` instead of `.next`, so `next start` without the flag never serves it;
- throws when the flag is set on Vercel.

`next start` reads `next.config.ts` again, so the server needs `AXIIS_E2E_BUILD=1` too, only to find `.next-e2e`. Setting it at runtime changes nothing inside a bundle, since the value is already inlined.

## The guard

`src/lib/supabase/fake-session.ts` is the only place that decides whether a request has the fake session. `isFakeSession` returns true only when every one of these holds:

1. `process.env.AXIIS_E2E_BUILD === "1"`, written as that literal so the bundler inlines it.
2. `E2E_FAKE_SESSION` is exactly `"1"`.
3. `VERCEL` is unset.
4. `E2E_FAKE_SESSION_SECRET` is at least 32 characters.
5. The request's `axiis-e2e-session` cookie equals that secret, compared in constant time.

Conditions 2 to 5 are read at runtime. There is no default secret, and no query string or header route in. When the guard says yes:

- The proxy treats the request as signed in.
- `getItemsRepo`, `getNotesRepo` and `getAreasRepo` return in-memory repos from `src/lib/supabase/fake-account.ts`, seeded with fixtures for the user `e2e@axiis.invalid`. The account lives on `globalThis`, so every route bundle in the one server process shares it, and each run starts a fresh server with fresh fixtures.
- The settings page shows that email, the export route reads the in-memory rows, and deleting the account resets the fixtures.
- The landing page sends the user to `/today`, and sign-out clears the cookie.

Everything else takes the unchanged production path. The proxy still runs `updateSession` first, which builds a Supabase client and asks for claims. With no Supabase cookie in the browser it finds no session, and the build points at the unused placeholder `http://localhost:54321`, so no real Supabase project is ever contacted.

The guard's tests are mutation-checked: removing or weakening any condition above fails them. One mutation no black-box test can catch is a non-empty default secret, since a test cannot guess it. Review keeps that out: the secret reads `process.env.E2E_FAKE_SESSION_SECRET ?? ""`, and the 32-character floor rejects the empty fallback.

## The /dev harness pages

The pages under `src/app/dev/` render fixtures without a session. `devHarnessEnabled()` in `src/lib/dev-harness.ts` turns them on in `next dev` and in the browser-test build. In a normal production build every one calls `notFound()`, and the proxy sends a signed-out visitor on `/dev/...` to sign in like any other app path.

A second cookie, `axiis-e2e-account=empty`, picks a second in-memory account that has the three seeded areas and no items, so a test can see the first-day state without emptying the account every other spec shares. The reset route resets whichever account the cookie picks. The cookie does nothing without the session cookie, and `check:no-fake-session` searches the build for its name too.

## Why production cannot reach it

Every function body in `fake-session.ts` sits inside `if (process.env.AXIIS_E2E_BUILD === "1")`. A normal build inlines `""` there, so the bundler drops the branch, the cookie name, the env names and the dynamic import of `fake-account.ts`.

`npm run check:no-fake-session` proves this on the real output. It builds `.next` with the CI placeholder env and the flag forced empty, then:

- searches every file under `.next/server` and `.next/static` for the guard's own strings (`E2E_FAKE_SESSION`, which covers the secret's env name, and `axiis-e2e-session`), in every built file except source maps;
- searches the same files, source maps included, for the fake account (`e2e@axiis.invalid`, the fixture id prefix, `axiisE2EAccount`);
- checks that a known production string is present, so an empty build cannot pass;
- serves the build with `next start`, `E2E_FAKE_SESSION=1` and a secret, sends that secret as the cookie, and expects `/today`, `/settings/export` and `/dev/score` to redirect to sign in.

Server source maps contain `fake-session.ts` as original source text, which never runs. That is why the guard's strings are not searched in `.map` files.

`npm run check:no-fake-session -- --control .next-e2e` runs the same search on the browser-test build and fails unless it finds every marker, so a search that has stopped matching cannot pass quietly. CI runs the normal check after `npm run build` in the `check` job, with `--skip-build`, and the control after the browser tests in the `e2e` job.

Unit tests in `src/lib/supabase/fake-session.test.ts` cover each missing condition, including a build without the flag. `src/lib/e2e-build.test.ts` covers what `next.config.ts` inlines, where it builds, the Vercel refusal and `devHarnessEnabled`. `src/proxy.test.ts` shows that a request with the right cookie is sent to `/login` without the flag or without `E2E_FAKE_SESSION`.

## Running it

```bash
npm run e2e                     # Chrome
E2E_CHANNEL=msedge npm run e2e  # Edge, on Windows
```

`playwright.config.ts` makes a fresh random secret per run, then runs `next build` and `next start` on port 3600 with `AXIIS_E2E_BUILD=1`, `E2E_FAKE_SESSION=1` and that secret. The workers inherit the secret. `e2e/session.ts` exports `signedIn`, a test whose browser context carries the cookie. The config never reuses a running server, because that server would not hold this run's secret or this build. Stop anything on port 3600 first.

To look at the signed-in screens by hand without Supabase, run `next dev` with the same variables: `AXIIS_E2E_BUILD=1 NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy E2E_FAKE_SESSION=1 E2E_FAKE_SESSION_SECRET=<32+ chars> npx next dev --webpack -p 3800`, then set the cookie `axiis-e2e-session` to that secret.

## What it does not cover

The fake session replaces Supabase, so these stay untested by the browser suite:

- Supabase Auth itself: the magic link, Google sign-in, the callback, session refresh.
- Row level security and the real PostgREST queries. `SupabaseItemsRepo` and the other Supabase repos never run in these tests.
- The real `delete_my_account` RPC and the real export reads.

The unit tests, the PGlite database tests and the owner's signed-in pass still cover those.
