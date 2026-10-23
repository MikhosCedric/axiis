# Data model

One connected `items` table, many views. A view is a query over items, never its own table. This file is the contract between the database, the data-access layer and the UI. `src/domain/item.ts` is its TypeScript form and wins on any disagreement about names.

## Tables (Postgres, Supabase)

All tables carry `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `created_at`, `updated_at` (trigger-maintained) and, where listed, `deleted_at` for soft delete. Row Level Security is on for every table, with one policy set per table: an `authenticated` user may select, insert, update and delete only rows whose `user_id = (select auth.uid())`. `anon` has no access.

Same-user integrity is enforced structurally, not by trigger: `items` has `unique (user_id, id)`, and every reference to an item or area is a composite foreign key `(user_id, x_id)`, so a row can never point at another user's row.

### `areas`
The user's parts of life (Work, Home, Health). `id`, `name`, `position double precision`, `color text null`, `deleted_at`. `unique (user_id, id)`.

`color` (migration 0009, palette widened by 0011) is a palette name or null for None. The check `areas_color_palette` allows only `clay`, `terracotta`, `ochre`, `mustard`, `moss`, `sage`, `slate`, `indigo`, `plum`, `mauve`, `rose` and `stone`, the names in `AREA_COLORS` (`src/domain/area-color.ts`). 0011 drops and re-adds the check with the larger set; every name 0009 allowed is still allowed, so no stored row breaks it. The database stores the name, never a hex value; the colours are design tokens (DESIGN.md, Colour for Areas). `setAreaColor` in `src/features/account/commands.ts` sets and clears it, and the export carries it.

### `items`
| column | type | notes |
|---|---|---|
| `id` | uuid pk default gen_random_uuid() | |
| `type` | enum `item_type` (`task`,`event`,`note`,`checklist`) | |
| `title` | text not null default '' | |
| `body` | jsonb null | rich text document (Tiptap JSON) |
| `status` | enum `item_status` (`open`,`done`,`dropped`) default `open` | notes stay `open` |
| `area_id` | uuid null | composite FK `(user_id, area_id)` to areas, `on delete no action`. Areas are soft-deleted, never hard-deleted by the app. |
| `parent_id` | uuid null | composite FK to items. Subtasks. |
| `position` | double precision not null default 0 | fractional ordering among siblings |
| `start_at`, `end_at` | timestamptz null | a timed item: both set, `end_at > start_at` |
| `scheduled_on` | date null | planned for a day with no time |
| `due_on` | date null | deadline, independent of the plan |
| `rrule` | text null | Set on a series: an allowlisted RFC 5545 rule, expanded at read time. See `docs/recurrence.md`. |
| `series_id` | uuid null | Set on an override: the series it belongs to. Composite FK `(user_id, series_id)` to items, `on delete cascade`. |
| `original_on` | date null | Set on an override: the local date of the occurrence it replaces. |
| `completed_at` | timestamptz null | set when status becomes `done` |
| `deleted_at` | timestamptz null | soft delete |

Checks:
- Timed and day-only plans are mutually exclusive: `not (start_at is not null and scheduled_on is not null)`.
- `start_at` and `end_at` are both null or both set, and `end_at > start_at`.
- `parent_id <> id`.
- Notes and events cannot have a parent, and a parent must be a `task` or `checklist` (trigger on insert or update of `parent_id`, `type`).
- Nesting is at most two levels: a parent's own `parent_id` must be null (same trigger).
- `type = 'note'` has no schedule (`start_at`, `end_at`, `scheduled_on`, `due_on` all null).
- Recurrence (migration 0004): `series_id` and `original_on` are both set or both null; an override is not its own series and never repeats; a note never repeats; a series has a schedule and no parent; `rrule` matches the canonical allowlist. A trigger keeps series and overrides out of the subtask hierarchy, requires an override's series to be a repeating top-level task, event or checklist, and refuses to clear a rule while live overrides point at it. A partial unique index allows one live override per `(series_id, original_on)`.

Due date (`setDue`, the detail panel's Due row): a task or checklist that does not repeat can set `due_on` to a local date or clear it. Only the date comes from the client. Nothing else reads it yet: it is not drawn on the Score, the week, the Inbox or rows, and nothing sorts or warns by it. The panel shows it, it is exported, and that is all. An event or a series that already carries one shows it read-only.

Changing type (`setType` in `src/features/detail/commands.ts`, the detail panel's Type row):
- A top-level task, event or checklist can become any of the three. A note never changes and nothing becomes a note, since a note has no schedule and opens in its own editor. A subtask keeps its type.
- An event cannot hold subtasks (the hierarchy trigger), so a parent is refused as an event with a sentence instead of a failed save. A task and a checklist both hold subtasks, so a parent moves freely between them.
- On anything that repeats, the type belongs to the series: it changes the series and every live override together, with no "This one", like tags.
- The schedule is left alone. An event with no time is allowed by the database and drawn as an any-time item; the panel says it needs a time and moves focus to the Time row, or to When if it has no day yet.
- No migration: the existing triggers already check the new type.

Indexes (all partial on `deleted_at is null`): `(user_id, start_at)`, `(user_id, scheduled_on)`, `(user_id, parent_id)`, `(user_id, area_id)`, `(user_id, status)`.

### `links`
A typed edge between two items, so notes reference tasks and backlinks work. `id`, `from_id`, `to_id`, `kind` (enum `link_kind`: `reference`). Composite FKs to items for both ends, `on delete cascade`. `unique (from_id, to_id, kind)`, `check (from_id <> to_id)`.

### `tags`, `item_tags`
`tags`: `id`, `name`, `color text null`, `unique (user_id, lower(name))`. `color` (migration 0011) takes the same palette names as `areas.color` under the check `tags_color_palette`, or null for none, the default for every tag, including one made by capture; `setTagColor` in `src/features/tags/commands.ts` sets and clears it, and the export carries it. `item_tags`: `(item_id, tag_id)` primary key, composite FKs for same-user integrity, `on delete cascade`.

How the app uses them (`src/domain/tag.ts`, `src/features/tags/`):
- A name is stored as typed but trimmed, with runs of spaces collapsed and a leading `#` dropped, 1 to 32 characters. Two names are one tag when they match without case. Limits: 10 tags per item, 200 per user, checked by the commands.
- Tags are hard-deleted. Deleting a tag removes its `item_tags` rows by cascade and never touches an item. Rename changes the one `tags` row.
- A series carries the tags for all its occurrences. An override of a live series has no tag rows of its own; it shows and edits the series' (`tagOwner`). See `docs/recurrence.md`.
- Open counts count live items whose status is `open`. They come from `tag_open_counts()` (migration 0008): a `security invoker` SQL function that groups the caller's `item_tags` joined to open, live items and returns one `(tag_id, open)` row per tag that has any, so a read is one request of at most 500 rows (the tag cap) however many items are tagged. Row Level Security still applies; the `user_id` filters let it use `item_tags_user_tag` and the items primary key. Execute is granted to `authenticated` only. The detail panel orders its tag suggestions by these counts, and the Tags page shows them. A tag's page lists live items that are not dropped, open first, then newest, at most 200.
- Every read of a tag row selects its colour (`TAG_COLUMNS`), so the tag lines a day, the Week and the Inbox already read carry their colours with no further request.
- Search reads `#name` words as a filter: words narrow the text hits to items carrying every named tag, or an override whose series carries them; tags alone list every item carrying them.

## Quotas (migration 0006)

Signup is open and PostgREST takes writes straight from the browser's session, so the database caps how much one account can hold. Where the app has its own limit, the cap sits well above it, so only a script writing to PostgREST directly reaches it. Items and links have no app limit: 20,000 items is about 11 years at five a day, subtasks and moved occurrences included.

| Table | Cap | The app's own limit |
|---|---|---|
| `items` | 20,000 per user | none |
| `links` | 50,000 per user | none |
| `tags` | 500 per user | 200 (`TAGS_PER_USER`) |
| `areas` | 100 per user | 12 live (`AREA_LIMIT`) |
| `item_tags` | 20 per item | 10 (`TAGS_PER_ITEM`) |

- Soft-deleted rows count. They keep their storage, and leaving them out would let an insert-then-delete loop run forever. Items soft-deleted more than 30 days ago are purged (below), so an account at its item cap frees room 30 days after it deletes.
- An `after insert` statement trigger checks the users (or items) in the inserted rows, counting at most cap + 1 rows through an index that leads with `user_id` (`item_id` for `item_tags`). A bulk insert that crosses the cap is refused whole. Two concurrent inserts can each see room and both land, so a cap can be overshot by a few rows.
- The functions are `security invoker` with `set search_path = ''`. Row Level Security shows a user all of their own rows, soft-deleted ones included, so the count is complete; signup's `handle_new_user` runs as the table owner and is not limited by RLS.
- A refusal is SQLSTATE `54000` (`program_limit_exceeded`). `src/lib/quota.ts` turns it into "This account has reached its size limit" for capture, new notes, links, areas, tags, subtasks and occurrence overrides.
- Only inserts are checked. Updates, soft deletes, and account deletion with its cascades are untouched. The migration adds `items (user_id, parent_id) where parent_id is not null`, so deleting an account with 20,000 items no longer scans the table once per item for the parent foreign key.
- The note body cap drops from 2 MB to 512 KB of jsonb (`items_body_size`). The editor refuses more than 200 KB of JSON (`BODY_MAX_BYTES`), which measured at most 1.5 times larger as jsonb.

## Purge (migration 0008)

`purge_deleted_items()` hard-deletes up to 500 of the caller's items soft-deleted more than 30 days ago, oldest first, and returns how many went. `deleteItem` calls it (`ItemsRepo.purgeDeleted`) after every delete, and ignores a failure, so a delete never fails because of it and the app works before 0008 is applied.

- `security invoker` with `set search_path = ''`: Row Level Security limits it to the caller's rows. Execute is granted to `authenticated` only. A new index `items (user_id, deleted_at) where deleted_at is not null` finds the rows.
- Links and `item_tags` go with their item by cascade. Tags stay.
- A parent stays while any of its children is not purged in the same call (`parent_id` has no delete action). Subtasks are soft-deleted with their parent, so they normally go together.
- `series_id` cascades, but a deleted series leaves its overrides as ordinary items. Overrides of a purged series that are not purged themselves are detached first (`series_id` and `original_on` set to null), as "Does not repeat" detaches them, so they are kept.
- Within any 30 days an insert-then-delete loop still holds at most the cap, so the quota keeps its purpose.
- `hasAnyItem` counts deleted rows as stored, so an account whose every item was deleted and purged sees the first-day examples again.
- Areas are not purged: their cap of 100 already leaves room to churn against 12 live ones.

## Account deletion (migrations 0002 and 0010; 0010 not yet applied)

`account_deletions (user_id uuid primary key references auth.users on delete cascade, requested_at timestamptz)`: one row while an account waits 14 days for deletion.

- Row Level Security: an `authenticated` user may select, insert and delete only their own row. There is no update grant, so a request is made or withdrawn, never moved. `anon` has nothing.
- `requested_at` is stamped `now()` by a `before insert` trigger, so a client cannot backdate its request into the purge window.
- `purge_due_accounts()` is `security definer` with `set search_path = ''`. It deletes from `auth.users` up to 50 accounts whose request is 14 or more days old, oldest first, so every public table cascades as for `delete_my_account`, and returns how many. Execute is revoked from `public`, `anon` and `authenticated` and granted to `service_role`; the owner schedules it with pg_cron (`docs/launch-checklist.md`, Account deletion purge).
- `delete_my_account()` ("Delete now") is unchanged and removes the row by cascade.
- The app reads the row on every signed-in page (`getDeletionRequest`, `src/lib/account/`) for the banner. A failed read counts as no request, so pages still render before 0010 is applied. Asking twice is an insert that ignores the duplicate, so the first date stands. Not part of the export.

## Rate limits (migration 0007)

The quotas bound how much an account holds, not how fast it adds rows. Every server action can be bypassed by calling PostgREST with the same session, so the throttle is in the database.

| Table | Rows added per account in any 60 seconds | What the app adds at once |
|---|---|---|
| `items` | 120 | one per capture, subtask, note or moved occurrence |
| `links` | 120 | one per link |
| `tags` | 60 | at most 10 new tags in one capture |
| `areas` | 30 | three at signup, one per "Add area" |

- `item_tags` has no rate limit: the quota holds it to 20 per item, and items are rate-limited.
- An `after insert` statement trigger counts the account's rows with `created_at` in the last 60 seconds, at most limit + 1 of them, through a new `(user_id, created_at)` index on each table. The statement's own rows count, so one bulk insert over the limit is refused whole.
- `created_at` is the database's clock: a `before insert or update` row trigger stamps `now()` on insert and keeps the old value on update. Without it a client could backdate its rows out of the window. Test and support scripts that need old rows run with `session_replication_role = replica` (`seed` in `tests/db/harness.ts`).
- A refusal is SQLSTATE `54R01`, our own code in the program-limit class, so it reads differently from a quota refusal: "You're going a little fast, so this was not saved. Try again in a moment." (`src/lib/quota.ts`).
- Updates and deletes are not limited. They do not grow an account, and the Vercel firewall rules in `docs/launch-checklist.md` bound request volume.

## Day query

A day is a half-open UTC range `[from, to)` computed by the client from the user's time zone. Items on that day are: timed items with `start_at` in range, plus day-only items with `scheduled_on` equal to the local date, leaving out series. Each live series is then expanded into its occurrences for the day, minus the dates a live override stands for. The database never stores a time zone or a "today".

The waiting items (top level, no schedule, not notes) are filtered in the query: open ones, plus ones completed inside the day's range, newest first, at most 200. The tray says so when it shows 200.

## Bounded reads

PostgREST answers at most `max-rows` rows (1000 on Supabase) and says nothing when it stops. So every read either has an explicit limit below that and a visible "showing the newest N" line when it is reached (the Inbox, the waiting tray, a week's planned items at 500, Lists, Due, a tag's page), or must be complete and is read in pages sized by an exact count (`readAll` in `supabase-repo.ts`: overrides, child counts, tags of items). Open counts per tag come from one `tag_open_counts()` call, which returns at most one row per tag (500 by the quota), so one request is complete.

## Lists query

The Lists page reads live top-level checklists that are not dropped and are not overrides, with or without a schedule (`listChecklists`). A repeating checklist comes once, as its series. Open ones come first, then done, newest first, at most 200. Line progress comes from one `childCounts` read for all of them.

## Not in Phase 1
Realtime, sharing, attachments. The schema leaves room (an owner column, no unique constraint blocking sharing) but builds none of it.
