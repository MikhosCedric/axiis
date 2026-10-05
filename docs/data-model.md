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
| `rrule` | text null | RFC 5545 recurrence rule, expanded at read time. Exceptions are a later phase. |
| `completed_at` | timestamptz null | set when status becomes `done` |
| `deleted_at` | timestamptz null | soft delete |

Checks:
- Timed and day-only plans are mutually exclusive: `not (start_at is not null and scheduled_on is not null)`.
- `start_at` and `end_at` are both null or both set, and `end_at > start_at`.
- `parent_id <> id`.
- Notes and events cannot have a parent, and a parent must be a `task` or `checklist` (trigger on insert or update of `parent_id`, `type`).
- Nesting is at most two levels: a parent's own `parent_id` must be null (same trigger).
- `type = 'note'` has no schedule (`start_at`, `end_at`, `scheduled_on`, `due_on` all null).

Indexes (all partial on `deleted_at is null`): `(user_id, start_at)`, `(user_id, scheduled_on)`, `(user_id, parent_id)`, `(user_id, area_id)`, `(user_id, status)`.

### `links`
A typed edge between two items, so notes reference tasks and backlinks work. `id`, `from_id`, `to_id`, `kind` (enum `link_kind`: `reference`). Composite FKs to items for both ends, `on delete cascade`. `unique (from_id, to_id, kind)`, `check (from_id <> to_id)`.

### `tags`, `item_tags`
`tags`: `id`, `name`, `unique (user_id, lower(name))`. `item_tags`: `(item_id, tag_id)` primary key, composite FKs for same-user integrity, `on delete cascade`.

## Day query

A day is a half-open UTC range `[from, to)` computed by the client from the user's time zone. Items on that day are: timed items with `start_at` in range, plus day-only items with `scheduled_on` equal to the local date. The database never stores a time zone or a "today".

## Not in Phase 1
Recurrence exceptions, full-text search column, realtime, sharing, attachments. The schema leaves room (an owner column, no unique constraint blocking sharing) but builds none of it.
