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

`expandSeries` in `src/lib/items/expand.ts` runs the `rrule` library on floating calendar dates (UTC midnights that stand for local dates) and puts each date back on the clock with `wallSpanOn` (`src/lib/dates.ts`). A timed series keeps its wall-clock start and end on every occurrence: 08:00 to 09:00 stays 08:00 to 09:00 on the day the clocks change, and 01:00 to 04:00 lasts two real hours the night they go forward and four the night they go back. The wall-clock times are read off the series' own schedule on its first date. When the clocks skip a start or an end that day, it becomes the first time they do show, the same time `setTime` offers when it refuses one (02:30 becomes 03:00). When they repeat it, the first one is used. When both fall in the skipped hour, so the end would not come after the start, the occurrence keeps the series' real length from its start (02:00 to 02:45 becomes 03:00 to 03:45).

Calendar behaviour follows RFC 5545:

- Monthly on the 31st skips months without one. Yearly on 29 February happens only in leap years.
- A weekly rule whose weekdays leave out the first date's weekday does not land on that first date.
- `COUNT` counts from the first occurrence, not from the start of the days shown.

A daily or weekly rule starts at its last whole period on or before the first day shown rather than at the series' first date, and a `COUNT` is reduced by the occurrences that skips, so the cost of a read does not grow with the age of the series. `expand.property.test.ts` checks this against running the rule from its first date over generated rules, spans and time zones; `expand.bench.test.ts` times a page (`BENCH=1`). Monthly and yearly rules still run from the first date: they step once a period, and a month without the day makes skipping ahead irregular.

One call never returns more than 400 occurrences and never looks past the end of the requested span. `listSeries` reads at most 200 live series.

The user's current time zone is used for expansion. Changing time zone after a series was made is out of scope.

## Keys

A virtual occurrence is drawn as a `VirtualItem` whose id is an occurrence key, `<seriesId>~<YYYY-MM-DD>`. A `~` never appears in a uuid. `parseItemKey` in `src/domain/item-key.ts` reads either form. Every command that takes an item id (mark done, place on the Score, move on the week, rename, area, delete, the detail loader, `?item=`) takes either form, and computes any schedule on the server. A key for a date the series does not fall on is refused.

## Editing

- **This one or all of them.** On an occurrence, rename and area go to that occurrence or to the series. "All of them" from an override also changes that override, so the one in view follows. Occurrences with no override follow the series.
- **Time.** `setTime` in `src/features/detail/commands.ts` takes local wall-clock minutes and a length, never an instant. "This one" times that occurrence on its own day. "All of them" moves the series' own schedule to that time on its first date (built with `instantAt`, start and end both on the wall clock, as expansion repeats them), so every occurrence without an override follows. The override it was changed from follows too; other overrides keep their own times. Something that does not repeat is refused. The end is typed on the wall clock too, so 01:30 to 04:00 on the night the clocks go forward reads back as typed though it lasts 90 real minutes, and a series set that way reads 01:30 to 04:00 on every other day. A start or end the clocks skip is refused with the first time that does happen ("02:30 does not happen on Sunday 8 March, when the clocks go forward. Try 03:00."), never quietly moved; for "All of them" the start and end are checked on the first date. Two ways in: after an occurrence gets a new time on the Score (drag or keyboard), the status line offers "Same time every day" (worded from the rule: every week on Tuesday, every weekday); and the detail panel has a Time row, on an occurrence following the panel's "This one / All of them" choice and on the series itself changing all of them. A week move only changes the day, so it offers nothing. The row's fields read a 24-hour clock typed loosely (`14:30`, `14.30`, `1430`, `930`) and write it back as `HH:MM`, matching the When line; a time they cannot read is marked and not saved.
- **Any time.** `clearTime` takes the time away and leaves the item on its day. With "All of them" the series becomes day-only on its first date, and the override it was changed from becomes day-only on its own date; other overrides keep their times. It is the Time row's "Any time" button, and works for "This one" too.
- **First day.** `setFirstDay` moves the series' first date. Only a date comes from the client. A timed series keeps its wall-clock start and end on the new date (`wallSpanOn`, as expansion places them). Every override stays as it is, the one it was changed from included, even one that now falls before the first date. A first date after an `UNTIL` end is refused. `COUNT` counts from the new first date. The detail panel shows the First day field on the series itself, and on an occurrence only while "All of them" is chosen.
- **Repeat menu.** Does not repeat, Every day, Every weekday, Every week, Every 2 weeks, Every month, Every year, with an end of never, a date or a number of times. On an occurrence it edits the series. An item waiting for a time starts repeating from today, and the status line says so ("Repeats every day from today"; from its own day when it has one). When the rule skips that day, as every weekday does a Saturday, the item moves to its first occurrence at the same time, and the status line names it ("Repeats every weekday, starting Monday 12 October."). A monthly rule from the 29th to the 31st, or a yearly one on 29 February, skips the months or years without that date, as the `rrule` library does; the status line and the summary under the Repeat menu say so ("Months with no 31st are skipped.").
- **Moving one occurrence.** With "This one", the When row's "Move to" puts that occurrence on today, tomorrow or another date (`planItem`, which materializes it and keeps its clock). It offers no "No day", since an occurrence stands for its date. With "All of them" the row only reads, and First day moves the series.
- **Type** belongs to the series, like tags: changing it on any occurrence changes the series and every override (`setType`). See `docs/data-model.md`.
- **Done.** The series panel has no done box and says "Each time is ticked done on its own day, on the Score or the week": done lives on each occurrence's override.
- **Due date.** Not editable on anything that repeats.
- **Does not repeat** detaches every override (they become ordinary items) and leaves the series as one item on its first date.
- **Skip this one** drops that occurrence.
- **Restore.** `restoreOccurrence` takes an occurrence key and sets its dropped override back to open, keeping anything changed on it before the skip. A retry succeeds without writing. An occurrence never skipped, a done one, a stored id and an override whose series is gone are refused. A skipped occurrence is not drawn on its day, so the series' panel lists its "Skipped dates", each with Restore, and an occurrence opened while skipped offers "Restore this one" in place of "Skip this one".
- **The series itself** shows the Time and First day rows too. It has no "This one", so both change all of them.
- **Dates in another year** name it: "until Thursday 7 January 2027", and the same on an occurrence's line and in the skipped dates. `describeRule` takes the user's local date for this.
- **Stop repeating from here** sets `UNTIL` to the day before. Later overrides that are not done are removed; done ones stay as a record. From the very first occurrence the series is deleted.
- **Deleting a series** soft-deletes it and leaves its overrides as ordinary items. Deleting "all of them" from an override also removes that override.
- Changing a rule can leave an override whose date the series no longer produces. It stays as an ordinary row.
- Linked notes on any occurrence attach to the series.
- **Tags** live on the series. An occurrence key, or an override of a live series, shows and edits the series' tags, so every time it repeats wears the same ones and there is no "This one" for tags; the panel says "Tags belong to every time it repeats". `tagOwner` in `src/domain/tag.ts` picks the owner. An override whose series is gone (deleted, or detached by "Does not repeat") is an ordinary item and carries only tags of its own, starting with none.

## Out of scope

Rules outside the allowlist, time zone changes after creation, subtasks on occurrences, notifications.
