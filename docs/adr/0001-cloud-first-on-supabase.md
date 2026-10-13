# 0001. Cloud-first on Supabase, one connected item model

Status: accepted, 2026-10-05

## Context

Axiis is a free, public, solo-user productivity app covering tasks, a planner, checklists and notes. It has one developer. It must stay efficient and easy to extend with new views and item kinds.

## Decision

- **Cloud-first.** Postgres on Supabase is the source of truth. Pages are server-rendered and changes go through Server Actions, so reads and writes both need a connection. (Amended 2026-10-13: this line first promised a TanStack Query read cache persisted to IndexedDB. It was never built, and the unused packages were removed. Offline capture is a roadmap item, below.)
- **One `items` table.** Task, event, note and checklist are item types. Subtasks are `parent_id`. Relations between items are `links`. Views are queries. See `docs/data-model.md`.
- **Same-user integrity by foreign key.** Every reference is a composite `(user_id, id)` key, so no row can point at another user's row, whatever the app code does. Row Level Security scopes every table to `auth.uid()`.
- **Next.js (App Router) and TypeScript** for the app, hosted on Vercel.
- **Domain model in the client is a union, not a bag of nullable columns.** `Schedule` is `unscheduled | day | timed`, mapped from and to row columns at the data boundary.

## Consequences

- No custom API server to run or secure. Supabase Auth, RLS and Realtime come with the platform.
- Adding a view or item kind needs no migration of existing data in most cases.
- Nothing works offline in v1, reads included. Offline capture (queue a new item while offline, send it on reconnect) is the first roadmap step if that becomes a priority; full local-first sync is a separate, larger decision. The item model rules out neither.
- Local Supabase needs Docker. Database behaviour is tested against PGlite (Postgres in WASM) with a stub `auth` schema, so tests run anywhere. Differences from a real Supabase stack must be checked against a hosted project before launch.
- Free-tier limits on Supabase and Vercel are acceptable for a free launch and are revisited if usage grows.

## Rejected

- **Local-first with sync** from day one: instant and offline, but sync and conflict handling cost more than a solo project can afford before the product is proven.
- **Separate tables per feature** (tasks, notes, checklists): simpler to start, but every connection between features becomes a join across silos.
