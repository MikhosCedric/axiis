# Security review, October 2026

A static review of the whole app surface on branch `launch-hardening` (2026-10-23), in the manner of gstack's `/cso`: the proxy and its policy, sign-in and the auth routes, every server action and route handler, the export, the browser-test session, the database (RLS, functions, grants, migrations 0001 to 0010), the client's save paths, dependencies, CI, and the public repository. Nothing was run against production. Severity is for a public launch with open signup.

| # | Severity | Finding | State |
|---|---|---|---|
| 1 | Critical | Next.js 16.4.0 has two advisories | Fixed by PR #81 (merged), merged into this branch |
| 2 | Medium | Personal email in the public git history | Owner action, documented |
| 3 | Medium | A save that cannot reach the server replaced the whole page | Fixed, except in the Today, Week and Month view files |
| 4 | Medium | Supabase accepts a password sign-up the app never offers | Owner action, documented |
| 5 | Low | No per-IP rate limit in the app | Owner action, documented |
| 6 | Low | No `Cross-Origin-Opener-Policy` | Fixed |
| 7 | Low | PostgREST filter strings are built by interpolation | Accepted |
| 8 | Low | The deletion banner fails open | Accepted |
| 9 | Low | Sign-out is a POST with no CSRF token | Accepted |
| 10 | Info | Stored note links are not checked on the server | Accepted |
| 11 | Info | The Supabase project ref is in the docs | Accepted |

## 1. Next.js 16.4.0 advisories (Critical)
`npm audit --omit=dev` reports GHSA-2464-fhr4-w9xw (remote code execution in the Image Optimization API when SVG files are used) and GHSA-p3m5-59mp-jv5r (denial of service through Server Actions) for `next` 16.0.0 to 16.4.0. CI's audit step failed on it. PR #81 (`fix-next-advisory`, merged) bumped `next` and `eslint-config-next` to 16.4.2, and this branch now carries it; `npm audit --omit=dev` finds nothing.

## 2. Personal email in the public git history (Medium, privacy)
`git log --format=%ae origin/main` shows a personal address on 386 commits, and the first three commits of this branch carry it too; later commits here use the GitHub noreply address. The repository is public, so the address is published. Fix going forward: the GitHub steps in `docs/launch-checklist.md` ("Keep my email addresses private", "Block command line pushes that expose my email", a noreply `user.email`). Removing it from history needs a rewrite of `main` and a force push, which breaks every clone and fork and cannot recall copies already made; that is the owner's call, and this review does not recommend it on its own.

## 3. A failed save replaced the whole page (Medium, integrity of what the user typed)
Client components call server actions inside `startTransition`. When the call itself rejects (offline, a dropped connection, a 5xx with no body), React sends the error to the nearest error boundary, so Settings, the detail panel or a note was replaced by "This page did not load." Reproduced on the browser-test build: Settings, offline, add an area (`e2e/fault.spec.ts`). `reach()` (`src/lib/reach.ts`) turns the rejection into `{ ok: false, error: "Could not reach Axiis. Check your connection and try again." }`, and every save in `src/features/{account,detail,inbox,notes,tags}` now awaits through it. Note body autosave already caught its own failures.

Not changed, because another branch is reworking those files: `src/features/day/day-view.tsx` (3 calls), `src/features/week/week-view.tsx` (2), `src/features/month/month-view.tsx` (1), `src/features/day/leftover-strip.tsx` (1), `src/features/today/capture-field.tsx` (1) and `src/features/today/done-toggle.tsx` (1). Capture is the one that matters most: it clears the field before the save, so a rejected capture loses the typed text. Each fix is `await reach(<the call>)`.

## 4. Password sign-up the app never offers (Medium, account pre-takeover)
Axiis signs in by email link or Google, but Supabase's email provider also accepts `auth.signUp({ email, password })` sent straight to the Auth API with the public key. If "Confirm email" were off, anyone could register a stranger's address with a password before its owner first signs in; the owner's later magic link opens the same account, and the password still works for the attacker. With confirmation on (Supabase's default), the account exists only once the address's owner clicks the link. Leaked-password protection is also off. Fix: `docs/launch-checklist.md`, Non-negotiables step 8 (keep "Confirm email" on, a 12-character minimum, leaked-password protection on the Pro plan). This is inferred from Supabase's documented behaviour; the hosted settings were not read.

## 5. No per-IP rate limit in the app (Low)
Already known and documented: the database bounds rows held (`0006`) and rows added a minute (`0007`), the login form waits 30 seconds per browser, and per-IP limits belong in the Vercel firewall and Supabase Auth (`docs/launch-checklist.md`, Rate limits; Turnstile, now ready behind `NEXT_PUBLIC_TURNSTILE_SITE_KEY`).

## 6. No Cross-Origin-Opener-Policy (Low)
Another origin that opened Axiis, or that Axiis opened, could keep a window handle on it. `next.config.ts` now sends `Cross-Origin-Opener-Policy: same-origin`; Google sign-in is a full-page redirect, so it is unaffected. `e2e/public.spec.ts` checks the header.

## 7. PostgREST filter strings built by interpolation (Low)
`.or(...)` strings in `src/lib/items/supabase-repo.ts` (four) and `src/lib/notes/supabase-repo.ts` (one) interpolate values. Each value is a parsed `LocalDate`, an ISO instant from a `Date`, or an id that passed `idSchema`, so no comma or parenthesis can reach the filter. Row Level Security would confine a malformed filter to the caller's own rows anyway. Keep every interpolated value parsed at the boundary.

## 8. The deletion banner fails open (Low)
`getDeletionRequest` treats a failed read as "no request", so the pages render before migration 0010 is applied and during an outage. During such an outage a user who asked for deletion does not see the banner. The purge is unaffected: it reads the table itself. Accepted for availability.

## 9. Sign-out POST without a CSRF token (Low)
`/auth/signout` signs out on any POST. A cross-site form would need the session cookies, which `@supabase/ssr` sets `SameSite=Lax`, so a cross-site POST carries none and signs nobody out (`sameSite: "lax"` is the default in `@supabase/ssr`'s cookie options; not tried in a browser). Server actions are already guarded by Next's Origin check.

## 10. Stored note links are not checked on the server (Info)
The editor refuses unsafe link targets (`safeHref`, `isAllowedUri`), but `saveNote` stores the body JSON as sent, so a script writing to PostgREST could store a `javascript:` link in its own note. Only that account reads it, and the nonce policy has no `unsafe-inline`, so a `javascript:` URL does not run. No change.

## 11. The Supabase project ref in the docs (Info)
`docs/PROGRESS.md` names the project ref. The ref grants nothing without a key, and the publishable key is public by design. The secret and service-role keys appear nowhere in the repository (`git grep` for key patterns, JWTs and `sb_secret_` found none; only `.env.example` is tracked).

## What held up
- Row Level Security on every table, one owner policy set each, composite foreign keys so no row can point at another user's row. New in 0010: `account_deletions` has select, insert and delete for the owner only, no update, a server-stamped `requested_at`, and `purge_due_accounts()` is executable by `service_role` and its owner only (`tests/db/account-deletion-grace.test.ts`).
- Every `security definer` function sets `search_path = ''` and acts only on `auth.uid()` or, for the purge, on due rows.
- A per-request nonce policy with `strict-dynamic` and no `unsafe-inline` for scripts, from one source (`src/proxy.ts`); the error and not-found pages carry it (`e2e/fault.spec.ts`). Turnstile's origin is opened on `/login` only, and only when its key is set.
- `safeNextPath` rejects every off-origin `next`; error codes are looked up in a `Map`.
- The browser-test session needs a build-time flag, a runtime flag, no `VERCEL`, and a 32-character secret compared in constant time; `check:no-fake-session` proves a normal build carries none of it.
- Error pages never render the error or its digest (`e2e/fault.spec.ts` looks for a marker in the thrown message).
- CI runs with a read-only token, actions pinned by SHA, `pull_request` (not `pull_request_target`), and `npm audit` on production dependencies.
