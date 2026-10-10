# Data model

One connected `items` table, many views. A view is a query over items, never its own table. This file is the contract between the database, the data-access layer and the UI. `src/domain/item.ts` is its TypeScript form and wins on any disagreement about names.

## Tables (Postgres, Supabase)

All tables carry `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `created_at`, `updated_at` (trigger-maintained) and, where listed, `deleted_at` for soft delete. Row Level Security is on for every table, with one policy set per table: an `authenticated` user may select, insert, update and delete only rows whose `user_id = (select auth.uid())`. `anon` has no access.

Same-user integrity is enforced structurally, not by trigger: `items` has `unique (user_id, id)`, and every reference to an item or area is a composite foreign key `(user_id, x_id)`, so a row can never point at another user's row.

### `areas`
The user's parts of life (Work, Home, Health). `id`, `name`, `position double precision`, `deleted_at`. `unique (user_id, id)`.

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
`tags`: `id`, `name`, `unique (user_id, lower(name))`. `item_tags`: `(item_id, tag_id)` primary key, composite FKs for same-user integrity, `on delete cascade`.

How the app uses them (`src/domain/tag.ts`, `src/features/tags/`):
- A name is stored as typed but trimmed, with runs of spaces collapsed and a leading `#` dropped, 1 to 32 characters. Two names are one tag when they match without case. Limits: 10 tags per item, 200 per user, checked by the commands.
- Tags are hard-deleted. Deleting a tag removes its `item_tags` rows by cascade and never touches an item. Rename changes the one `tags` row.
- A series carries the tags for all its occurrences. An override of a live series has no tag rows of its own; it shows and edits the series' (`tagOwner`). See `docs/recurrence.md`.
- Open counts count live items whose status is `open`. A tag's page lists live items that are not dropped, open first, then newest, at most 200.
- Search reads `#name` words as a filter: words narrow the text hits to items carrying every named tag, or an override whose series carries them; tags alone list every item carrying them.

## Day query

A day is a half-open UTC range `[from, to)` computed by the client from the user's time zone. Items on that day are: timed items with `start_at` in range, plus day-only items with `scheduled_on` equal to the local date, leaving out series. Each live series is then expanded into its occurrences for the day, minus the dates a live override stands for. The database never stores a time zone or a "today".

The waiting items (top level, no schedule, not notes) are filtered in the query: open ones, plus ones completed inside the day's range, newest first, at most 200. The tray says so when it shows 200.

## Bounded reads

PostgREST answers at most `max-rows` rows (1000 on Supabase) and says nothing when it stops. So every read either has an explicit limit below that and a visible "showing the newest N" line when it is reached (the Inbox, the waiting tray, a week's planned items at 500, Lists, Due, a tag's page), or must be complete and is read in pages sized by an exact count (`readAll` in `supabase-repo.ts`: overrides, child counts, tags of items, open counts per tag).

## Lists query

The Lists page reads live top-level checklists that are not dropped and are not overrides, with or without a schedule (`listChecklists`). A repeating checklist comes once, as its series. Open ones come first, then done, newest first, at most 200. Line progress comes from one `childCounts` read for all of them.

## Not in Phase 1
Realtime, sharing, attachments. The schema leaves room (an owner column, no unique constraint blocking sharing) but builds none of it.
