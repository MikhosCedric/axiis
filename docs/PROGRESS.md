# Axiis progress and resume guide

Read this first in a new session. It is the cheap way to get oriented. Update it whenever a phase lands.

## What Axiis is
A free, solo-user productivity web app. Tasks, a planner, checklists and notes sit on one connected item model. Purpose, brand and principles: `PRODUCT.md`. Vocabulary: `CONTEXT.md`. Data shape: `docs/data-model.md`. Decisions: `docs/adr/`.

## Where things live
| Area | Path |
|---|---|
| Domain types (`Item`, `Schedule`, ...) | `src/domain/item.ts` |
| Persistence interface and Supabase impl | `src/lib/items/{repo,supabase-repo,mappers,index}.ts` |
| Dates, time zones, DST-safe day ranges | `src/lib/dates.ts` |
| Auth (proxy, redirect rules, callback, login) | `src/proxy.ts`, `src/lib/auth/`, `src/app/(auth)/`, `src/app/auth/` |
| Day screen (routes, nav, load) | `src/features/day/`, `src/app/(app)/{today,day/[date]}/` |
| The Score (layout, drag, list) | `src/features/score/` (pure logic in `layout.ts`, `drop.ts`, `snap.ts`) |
| Detail panel and subtasks | `src/features/detail/` |
| Week planner | `src/features/week/`, `src/app/(app)/week/` |
| Inbox (open items with no day, plan for a day) | `src/features/inbox/`, `src/app/(app)/inbox/`, harness `src/app/dev/inbox/` |
| Lists (top-level checklists with progress, capture a checklist) | `src/features/lists/`, `src/app/(app)/lists/`, harness `src/app/dev/lists/` |
| Notes, links, search | `src/features/notes/`, `src/lib/notes/`, `src/app/(app)/{notes,search}/` |
| Tags (pages, detail field, row lines, Settings section) | `src/domain/tag.ts`, `src/features/tags/`, `src/app/(app)/tags/`, harness `src/app/dev/tags/` |
| Settings, areas, export, account deletion | `src/features/account/`, `src/lib/areas/`, `src/app/(app)/settings/` |
| Landing, legal drafts, metadata, PWA, error states | `src/app/{page,privacy,terms,not-found,error,manifest,sitemap,robots}`, `src/features/landing/`, `src/components/public/`, `src/lib/site.ts` |
| Launch checklist (owner tasks) | `docs/launch-checklist.md` |
| Capture and mark-done commands, the shared done tick and the line-form key | `src/features/today/` |
| Shell (nav rail, theme, tz cookie) | `src/components/shell/` |
| Design tokens | `src/app/globals.css` |
| Design system as shipped (tokens, type, line-form state, components, rules) | `DESIGN.md`, sidecar `.impeccable/design.json` |
| Design audit (a11y, responsive, performance, drift; findings by severity) | `docs/design-audit.md` |
| Database | `supabase/migrations/`, tests in `tests/db/` (PGlite, no Docker) |
| Browser tests on the real signed-in routes (dev-only fake session, its guard and the production check) | `src/lib/supabase/{fake-session,fake-account}.ts`, `e2e/{session.ts,signed-in.spec.ts}`, `scripts/check-no-fake-session.mjs`, `docs/e2e-session.md` |
| Dev-only harness pages (blocked in production) | `src/app/dev/{score,week,inbox,lists,detail,notes,settings,palette,tags}/`, their shared detail actions in `src/app/dev/detail-actions.ts` |
| Visual prototype that set the direction | `prototypes/today-score/index.html` |

## Conventions that matter
- **Command pattern.** Logic lives in `commands.ts` taking an `ItemsRepo`, tested against `fakeRepo` in `src/features/today/test-support.ts`. Server actions in `actions.ts` are thin: zod-validate, call the command, `refresh()`.
- **Pure logic has no React.** Score layout, snapping, drop-to-patch are plain modules with tests.
- **Boundaries parse, internals trust.** Rows and env are parsed with zod once. `Schedule` is a union (`unscheduled | day | timed`), never nullable columns past the mapper.
- **Time.** Schedules are built from local wall-clock minutes with `instantAt`, never `+24h` arithmetic.
- **State is shown by line form** (solid live, dashed planned, hollow done). Accent colour means now, drag target or primary focus only. Voice: quiet, plain, no exclamation marks, no guilt copy.
- **Next.js 16.** Breaking changes from older versions. Read `node_modules/next/dist/docs/` before touching routing, proxy (formerly middleware), fonts or server actions. `next dev` appends an agent-rules block to `CLAUDE.md`; do not commit that.
- **Windows.** Files use CRLF in the working copy. Prefer the Edit tool over regex scripts on source files.

## Commands
```bash
npm run dev          # needs .env.local (Supabase URL + publishable key)
npm run lint && npm run typecheck && npm test && npm run build   # what CI runs
npm run check:no-fake-session   # builds, then proves the e2e fake session is absent from the output (CI runs it)
npm run e2e                     # Playwright and axe; E2E_CHANNEL=msedge on Windows. See docs/e2e-session.md
```

## Supabase
- Hosted project `axiis`, ref `eseknelafyqcvqhqvfua`, region ap-northeast-1, free plan. A separate paused project `zenith-flow` belongs to the owner and is not used.
- Schema applied from `supabase/migrations/*.sql`. Every migration must also be applied to the hosted project (via the Supabase MCP `apply_migration`) and checked with `get_advisors`.
- Auth: email magic link works. Google needs a client ID and secret set in the dashboard.
- No Docker on the dev machine, so database tests run on PGlite with a stub `auth` schema. Check anything subtle against the hosted project, inside a rolled-back `DO` block.

## Status
Updated: see the log at the bottom. Phases:

| Phase | State |
|---|---|
| 0 Brand and design direction | done (prototype, `PRODUCT.md`) |
| 1 Foundation (schema, auth, shell, CI) | done, merged |
| 2 Tasks (any-day nav, Score, drag scheduling, subtasks, detail panel) | done, merged |
| 3 Planner (week view, drag between days) | done, merged (PR #5) |
| 4 Notes, links, full-text search | done, merged (PR #8), migration 0003 applied |
| 5 Account (settings, areas, export, deletion) | done, merged (PR #7), migration 0002 applied |
| 6 Public site (landing, legal drafts, metadata, PWA, error states) | done, merged (PR #6) |
| 7 Command palette, shortcuts help, browser tests (e2e + axe) | done, merged (#10, #12) |
| 8 Recurring tasks | done, merged (#13), migration 0004 applied |
| 9 Tags, Inbox, Lists, DESIGN.md, audits | done, merged: Inbox (#15), series time (#16), series quality (#17), tags (#18), Lists (#19), DESIGN.md and audit (#20), recurrence follow-ups (#21), audit fixes (#22) |
| 10 Signed-in verification, launch | next (see Next up) |

## Accepted advisories (Supabase security advisor)
- `delete_my_account` is executable by `authenticated` through RPC. Intended: it only deletes the caller's own account (`auth.uid()`), and `anon`/`public` are revoked.
- Leaked-password protection is off. Axiis has no passwords (magic link and Google only), so it does not apply.

## Migrations applied to the hosted project
`0001_core`, `0002_account` (applied as `account_deletion`), `0003_search` (applied as `search_and_excerpt`). `0004_recurrence` (applied as `recurrence`). Any new file in `supabase/migrations/` must be applied with the Supabase MCP `apply_migration`, after a rolled-back `DO` block check, then `get_advisors`.

## In flight
- Recurrence merged (#13). Migration 0004 applied to the hosted project; `get_advisors` then failed with an FGA auth error, so re-run the security advisor and do a non-DDL check of the new columns.
- Merged this stretch: command palette (#10), phone nav fix (#11), Playwright and axe browser tests with an `e2e` CI job (#12).

## Next up (suggested order)
1. **Owner: a signed-in pass** (the agent cannot receive the magic link): capture, Inbox plan-for, a repeat with "Same time every day", skip and restore a day, set a series to "Any time", tags (add, remove, rename, delete, `/tags/[name]`, `#tag` search), `/lists` (capture a checklist, tick lines), the detail panel on a real phone (plan a one-off for a day and a time, make a task an event, set and clear a due date), and the nav bar on a real phone. Report anything off.
2. Owner-only launch items: `docs/launch-checklist.md` (Vercel, domain, Google OAuth, production redirect URLs, real name and contact in the legal drafts).
3. Deferred design calls in `docs/design-audit.md` (beam labels on short beams, verdigris hover wash, dark-token duplication, headline utility, chip edges).
4. The When, Starts and Due lines show no year; they could use `formatDayIn`. The "Part of" link lacks the pending state.
5. Extend the signed-in e2e specs (`e2e/signed-in.spec.ts`): drag on the real Score and Week, the detail panel, notes editing, tag rename, account deletion.
6. A partial unique index on `areas (user_id, lower(name)) where deleted_at is null` (the app already refuses duplicates; this only closes a race).
7. Order search by rank (RPC), flush pending note saves before nav-rail navigation, subtask counts on week rows, shared date picker for the day and week navs.

## Known gaps and risks
- The e2e suite now visits the real signed-in routes through a dev-only fake session with in-memory repos (`docs/e2e-session.md`): the proxy, layouts, nav rail and server actions are covered there. Supabase Auth (magic link, Google, callback, refresh), row-level security and the Supabase repos are not, because the fake session replaces them.
- Saves through the real repo and row-level security have been verified by unit tests and a rolled-back SQL check, but not through a signed-in browser session against Supabase (the agent cannot receive the magic link).
- `next dev` on Windows is slow under the parallel suite, so the signed-in specs allow 90 seconds per test and 30 per assertion.
- The Score/List view-transition morph has not been seen playing; the preview pane reports the page hidden.
- Touch drag tested with synthetic events only.
- Restoring a skipped day is verified by unit tests against `fakeRepo` and the detail harness (e2e and axe), not by a signed-in session. "Skipped dates" lists every skipped date of a series, with no cap.
- Series time, "Any time" and first day are verified by unit tests against `fakeRepo` (including DST days) and the score and detail harnesses (e2e and axe), not by a signed-in session. The Time row is two 24-hour text fields; date fields (First day, the repeat end, the day and week pickers) are still native and show dates in the browser's locale format.
- The detail panel goes inert and `aria-busy` while the day, week or inbox screen switches items. A link inside the panel (the "Part of" parent link) navigates without that pending state.
- Tags are verified by unit tests against `fakeRepo`, a stubbed PostgREST test, a PGlite export test and the tags and settings harnesses (e2e and axe), not by a signed-in session. A `#tag` search with words filters the 30 text hits search returns, so a common word can hide older tagged matches. A tag-only search lists stored items, so an override of a tagged series shows only under its series.
- Planning, Type and Due from the detail panel are verified by unit tests against `fakeRepo` (DST days included) and the detail harness (e2e and axe at desktop, dark and 375px), not by a signed-in session. Due is still shown only in the panel and the export; nothing sorts or warns by it. An event with no time is allowed and drawn as an any-time item.
- The Inbox is verified by unit tests, a stubbed PostgREST query test and its dev harness (e2e and axe), not by a signed-in session.
- Lists are verified by unit tests against `fakeRepo`, a stubbed PostgREST query test and the `/dev/lists` harness (e2e and axe, with an item open), not by a signed-in session. A series cannot have subtasks, so a repeating checklist's row shows how it repeats instead of progress. Progress counts every live line, so a dropped line counts as not done, as the Inbox and Score counts already do.
- The tags and lists harnesses keep their store in memory, so a page reload from `next dev` after a cold compile empties it. The e2e warm-up compiles both first.
- Notes, week, settings, export and deletion are verified by unit tests, rolled-back SQL on the hosted project and dev harnesses, not by a signed-in browser session.
- `[`/`]` shortcuts do nothing on layouts where those keys need AltGr; the on-screen buttons work everywhere.

## Things only the owner can do
- Deploy (Vercel), domain, Google OAuth client, production Supabase redirect URLs.
- Put real name and contact email into the privacy policy and terms (placeholders are marked).

## Log
- 2026-10-07 (e2e session): browser tests on the real signed-in routes through a dev-only fake session (`src/lib/supabase/fake-session.ts`), with in-memory repos for `e2e@axiis.invalid`; `check:no-fake-session` in CI proves a production build carries none of it. Specs for the nav rail, capture to Inbox to tomorrow, Lists, Tags, Settings and export, sign-out, and axe on `/today`, `/inbox`, `/settings`. PR from `feat-e2e-session`. No migration.
- 2026-10-07 (shell critique): the phone nav stays inside 375px; the no-day pile is "Waiting" everywhere and the trays link to the Inbox; a printed line-form key on the Score and Week; tag pages and Lists tick items done through the shared `DoneToggle` (`src/features/today/done-toggle.tsx`); Tags index aligned left; quieter rail Areas; a Today icon; neutral loading skeletons (`src/components/page-skeleton.tsx`); 44px view switches on touch and landing links. See `docs/design-audit.md`, "Shell critique follow-ups". PR #28 from `fix-critique-shell`. No migration.
- 2026-10-07 (plan in panel): the detail panel plans any one-off item (Plan for / Move to: Today, Tomorrow, Another day, No day) and times it once it has a day, reusing `planItem`, `moveItem`, `setTime` and `clearTime`; Type is a Task / Event / Checklist choice (`setType`, whole series on repeats); Due is set and cleared (`setDue`, one-off tasks and checklists); Repeat says where a series starts and the series panel says who ticks it done. Answers the critique's P1 that a one-off could only be planned by dragging. The sheet is now keyed by the key it was opened with, so the first "This one" change to an occurrence no longer remounts it and loses its status line. PR #26 from `feat-plan-in-panel`. No migration.
- 2026-10-07 (audit fixes): the design audit's three P1s and its cheap P2s. The detail panel scrolls into view and takes focus below 1180px; selected Score List rows are AA; the landing lists what ships; 44px icon buttons and a press-and-hold hint on touch; a focus rule on the note body. Design calls are deferred in `docs/design-audit.md`. PR #22 from `fix-audit`. No migration.
- 2026-10-06 (recurrence follow-ups): `restoreOccurrence` and "Skipped dates" on the series panel, "Restore this one" on a skipped occurrence; repeat ends, occurrence lines and skipped dates name the year when it is not this year's (`formatDayIn`, shared with the palette); Time and First day rows on the series itself; `loadDetail` takes `now`. PR #21 from `feat-recurrence-followups`. No migration.
- 2026-10-06 (lists): `/lists` with checklists open first, a line-form progress meter, and capture that opens the new checklist beside the list; Lists in the nav and the palette; `listChecklists` on the repo; selected Inbox rows readable on the accent wash (axe now checks the Inbox and Lists with an item open). PR #19 from `feat-lists`. No migration.
- 2026-10-06 (tags): Tags section in the detail panel, `#tag` lines on rows, `/tags` and `/tags/[name]`, nav and palette (`#name`), rename and delete in Settings, `#tag` in search, tags on a series shared by its occurrences. PR #18 from `feat-tags`. No migration.
- 2026-10-06 (series quality): `clearTime` and `setFirstDay` for a whole series from the detail panel; the old panel is inert while the next item loads (shared `DetailAside`); empty-tray copy no longer says everything has a time; Time row typed on the 24-hour clock. PR #17 from `feat-series-quality`. No migration.
- 2026-10-06 (series time): owner found that dragging one day of a day-only series to 14:00 timed only that day. `setTime` command, "Same time every day" on the Score's status line, a Time row in the detail panel for occurrences. PR #16 from `feat-series-time`. No migration.
- 2026-10-06 (Inbox): `/inbox` with plan-for-a-day, nav and palette links, `/dev/inbox` harness; PR #15 from `feat-inbox`. No migration.
- 2026-10-05: Phases 0 to 2 merged to `main` (PRs #1 to #3). Owner away; overnight run started.
- 2026-10-06 (later): palette merged (#10); usage limit reached while e2e and recurrence were pending.
- 2026-10-06: Prep (#4), week planner (#5), public site (#6), account (#7), notes and search (#8) merged. Migrations 0002 and 0003 applied to the hosted project and verified in rolled-back blocks. Nav links and copy refresh in progress.
