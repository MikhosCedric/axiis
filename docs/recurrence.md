# Recurrence

How repeating tasks, events and checklists work. The database form is in `supabase/migrations/0004_recurrence.sql`, the TypeScript form in `src/domain/item.ts` (`Recurrence`, `VirtualItem`) and `src/domain/recurrence.ts` (`Rule`).

## Model

- A **series** is one stored item whose `rrule` is set. Its own schedule is the first occurrence: a timed start and length, or a day. Only a top-level task, event or checklist with no subtasks can be a series. A note, a subtask or a parent never repeats.
- **Occurrences are not stored.** They are expanded at read time for the days being shown.
- An **override** is an ordinary item row with `series_id` set to the series and `original_on` set to the local date of the occurrence it replaces. It carries that one occurrence's own title, schedule, area and status. It never repeats itself.
- Touching one occurrence (done, rename, area, drag, move, skip) creates its override first ("materialize on touch"), then changes it. Doing that twice still leaves one override: a partial unique index on `(series_id, original_on)` backs this, and a request that loses the race reads the winner's row.
- A skipped occurrence is an override with status `dropped`.
- Whenever a live override exists for a date, the virtual occurrence for that date is not drawn, even if the override was moved to another day.

## Rules

`Rule` is the allowlisted slice of RFC 5545 that Axiis uses, parsed once at the boundary:

| part | allowed |
|---|---|
| `FREQ` | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` |
| `INTERVAL` | 1 to 99 |
| `BYDAY` | weekly rules only, any of `MO`..`SU`, no ordinals |
| `UNTIL` | a date, `YYYYMMDD`, inclusive |
| `COUNT` | 1 to 1000 |

`UNTIL` and `COUNT` never appear together. Everything else (`BYSETPOS`, `BYHOUR`, `BYMONTHDAY`, `EXDATE`, an `RRULE:` prefix, a time on `UNTIL`) is refused by the parser, and the canonical string is also checked by a database constraint.

## Expansion

`expandSeries` in `src/lib/items/expand.ts` runs the `rrule` library on floating calendar dates (UTC midnights that stand for local dates) and puts each date back on the clock with `instantAt`. A 09:00 item therefore stays at 09:00 local through daylight-saving changes. When the clocks skip the time, it moves forward with them. When they repeat it, the first one is used. The length of a timed item is kept in absolute minutes.

Calendar behaviour follows RFC 5545:

- Monthly on the 31st skips months without one. Yearly on 29 February happens only in leap years.
- A weekly rule whose weekdays leave out the first date's weekday does not land on that first date.
- `COUNT` counts from the first occurrence, not from the start of the days shown.

One call never returns more than 400 occurrences and never looks past the end of the requested span. `listSeries` reads at most 200 live series.

The user's current time zone is used for expansion. Changing time zone after a series was made is out of scope.

## Keys

A virtual occurrence is drawn as a `VirtualItem` whose id is an occurrence key, `<seriesId>~<YYYY-MM-DD>`. A `~` never appears in a uuid. `parseItemKey` in `src/domain/item-key.ts` reads either form. Every command that takes an item id (mark done, place on the Score, move on the week, rename, area, delete, the detail loader, `?item=`) takes either form, and computes any schedule on the server. A key for a date the series does not fall on is refused.

## Editing

- **This one or all of them.** On an occurrence, rename and area go to that occurrence or to the series. "All of them" from an override also changes that override, so the one in view follows. Occurrences with no override follow the series.
- **Time.** `setTime` in `src/features/detail/commands.ts` takes local wall-clock minutes and a length, never an instant. "This one" times that occurrence on its own day. "All of them" moves the series' own schedule to that time on its first date (built with `instantAt`; the length is kept in real minutes, as expansion keeps it), so every occurrence without an override follows. The override it was changed from follows too; other overrides keep their own times. Something that does not repeat is refused. Two ways in: after an occurrence gets a new time on the Score (drag or keyboard), the status line offers "Same time every day" (worded from the rule: every week on Tuesday, every weekday); and the detail panel has a Time row for an occurrence that follows the panel's "This one / All of them" choice. A week move only changes the day, so it offers nothing.
- **Repeat menu.** Does not repeat, Every day, Every weekday, Every week, Every 2 weeks, Every month, Every year, with an end of never, a date or a number of times. On an occurrence it edits the series. An item waiting for a time starts repeating from today.
- **Does not repeat** detaches every override (they become ordinary items) and leaves the series as one item on its first date.
- **Skip this one** drops that occurrence.
- **Stop repeating from here** sets `UNTIL` to the day before. Later overrides that are not done are removed; done ones stay as a record. From the very first occurrence the series is deleted.
- **Deleting a series** soft-deletes it and leaves its overrides as ordinary items. Deleting "all of them" from an override also removes that override.
- Changing a rule can leave an override whose date the series no longer produces. It stays as an ordinary row.
- Linked notes on any occurrence attach to the series.

## Out of scope

Rules outside the allowlist, time zone changes after creation, subtasks on occurrences, notifications.
