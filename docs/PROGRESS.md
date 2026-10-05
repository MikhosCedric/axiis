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
| Capture and mark-done commands | `src/features/today/` |
| Shell (nav rail, theme, tz cookie) | `src/components/shell/` |
| Design tokens | `src/app/globals.css` |
| Database | `supabase/migrations/`, tests in `tests/db/` (PGlite, no Docker) |
| Dev-only harness pages (blocked in production) | `src/app/dev/{score,detail}/` |
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
| 3+ See "Overnight run" below | in progress |

## Known gaps and risks
- Saves through the real repo and row-level security have been verified by unit tests and a rolled-back SQL check, but not through a signed-in browser session (the agent cannot receive the magic link).
- The Score/List view-transition morph has not been seen playing; the preview pane reports the page hidden.
- Touch drag tested with synthetic events only.
- Recurrence column exists but is not expanded yet.
- `[`/`]` shortcuts do nothing on layouts where those keys need AltGr; the on-screen buttons work everywhere.

## Things only the owner can do
- Deploy (Vercel), domain, Google OAuth client, production Supabase redirect URLs.
- Put real name and contact email into the privacy policy and terms (placeholders are marked).

## Log
- 2026-10-05: Phases 0 to 2 merged to `main` (PRs #1 to #3). Owner away; overnight run started.
