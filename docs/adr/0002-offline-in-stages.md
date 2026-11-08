# 0002. Offline in stages, Supabase stays the source of truth

Status: accepted, 2026-11-08. Amends ADR-0001 (its "Nothing works offline" consequence).

## Context

The desktop app (Phase 1) loads the hosted Next.js app. Pages are rendered on the server and every write is a Server Action, so with no network the window shows nothing and a capture is lost. The owner approved starting offline work on 2026-11-08, and chose earlier (desktop plan, decision 5) to begin with capture only.

A local `ItemsRepo` adapter cannot make server-rendered pages work offline: the repo runs on the server. "The UI reads local" therefore needs a client-rendered UI, which is the large step the plan calls Phase 3. That step should be decided with evidence from the smaller ones, not before.

## Decision

Offline arrives in three stages. Each ships on its own and none changes the source of truth.

1. **Offline capture (Phase 2a).** The capture field keeps working with no network. A capture that cannot reach the server is written to a per-device outbox (the page's localStorage, keyed by user id: the entries are short text, at most 200) and shown as "Saved on this device, will send when you are back online". When the connection returns, the outbox is sent through the same capture Server Action, oldest first, and removed only after the server answers. In the desktop app, a small local page replaces the browser error when the app cannot load (a later step of 2a). No reads are served offline.
2. **Read cache (Phase 2b).** The pages visited lately (Today, Inbox, Week) are readable offline from a cache with a visible "Offline, showing saved data" state. Writes other than capture are refused with a clear message. Decide after 2a has been used.
3. **Local-first (Phase 2c).** A `LocalItemsRepo` (SQLite through Tauri, IndexedDB on the web), an outbox for every write, pull by `updated_at` cursor, soft-delete tombstones, last write wins per field with the losing note body kept as a version. This needs the client-rendered UI and is a separate ADR when 2b has been lived with.

## Rules for the outbox

- **Idempotent.** Each queued capture carries a client-made id (uuid). The server stores an item with that id once; a resend of an id it already holds returns the existing item. A flaky connection can never create duplicates.
- **Server decides.** The capture text is parsed on the server when it is sent, with the time zone and the clock of the moment it was typed (sent with the entry), so "tomorrow" means the day the user meant.
- **Per user.** The outbox is keyed by user id; a different account on the same device never sees or sends it. It stays for its owner after a sign-out and is sent when they are back.
- **Bounded.** At most 200 entries and the existing title limit; a full outbox refuses the capture with a message rather than dropping the oldest.
- **Failure is visible.** An entry the server rejects (title too long, item cap reached) stays listed with the reason and can be edited or discarded.
- **No new trust.** RLS stays the real boundary. The outbox holds only text the user typed; no tokens.

## Consequences

- The web app and the desktop app share this code, so it works in a browser tab too.
- Stage 1 needs one small server change (accepting a client id) and a migration only if the id cannot be used as the primary key directly.
- Until stage 2, opening the app offline shows the offline page, not data. This is stated in the app, not hidden.
- Encryption of local data at rest, and a keychain-held key, are decided in 2c, not now (the outbox holds short text only).

## Rejected

- **Starting with the local database.** Largest cost, and it cannot work with server-rendered pages anyway.
- **A service worker that caches API responses and replays any write.** Hard to reason about conflicts and the replay of Server Actions is not a supported contract.
