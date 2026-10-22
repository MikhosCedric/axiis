# Axiis

A solo productivity web app. One connected set of items, shown through many views.

## Glossary

**Item**: the single unit of content. Everything the user captures is an item: a task, an event, a note or a checklist. Never "todo", "entry" or "card".

**Type**: what kind of item it is. `task`, `event`, `note`, `checklist`. A type changes how an item is drawn and what it may do (a note has no schedule), not which table it lives in.

**Area**: one of the user's parts of life, such as Work, Home or Health. Shown as a staff on the Score. Never "category", "project" or "list". An area may have a **Colour** from a fixed palette, or None; it is shown as a dot beside the area's name, never as a category colour.

**Schedule**: where an item sits in time. Exactly one of *unscheduled*, *day* (planned for a date, no time) or *timed* (a start and an end). Distinct from the **due date**, which is a deadline and independent of the plan.

**Subtask**: an item whose parent is another item. At most two levels. A checklist is a parent whose children are small; a checklist line can be promoted to a task.

**Series**: an item that repeats. It stores the rule, and its own schedule is the first occurrence. Only a top-level task, event or checklist with no subtasks can be one. Never "recurring task template" or "parent" (parent means subtasks).

**Occurrence**: one time a series happens. Not stored: expanded at read time and named by the key `<seriesId>~<YYYY-MM-DD>`.

**Override**: a stored item that stands in for one occurrence, with its own title, schedule, area and status. Made the first time that occurrence is changed. A skipped occurrence is an override that is dropped; restoring it opens that override again. Never "exception" in the UI.

**Tag**: a short label the user puts on any item, shown as `#name`. One item can carry several and one tag spans every area. Matched without case. On a series, the tag belongs to every occurrence. Never "label" or "category" in the UI.

**Link**: a typed edge between two items, such as a note referencing a task. Backlinks are links read in reverse.

**View**: a query over items, never its own data. Score, List, Week, Month and Today are views.

**Month**: the view of one calendar month as whole weeks. Each day shows what is planned on it (a timed item on every day it covers), what falls due on it, and how many more there are. Items with no day never appear on it. Capture there lands on the day in focus.

**Lists**: the view of every top-level checklist, open first, each with how many of its lines are done. A checklist's subtasks are called its lines there. A repeating checklist shows once, as its series.

**Due**: the view of every open task and checklist that has a due date, soonest first, in three groups: Past due, This week (today and the six days after) and later. Items done in the last day stay listed so a tick can be undone. A series never appears: a deadline on every occurrence would be the same date each time. Wording never counts days late.

**Left over**: open one-off tasks and checklists planned for a day before today (a day, or a time that began before today's start in the user's zone). Today names the first few below the day and moves them to today one at a time or all at once; a timed one keeps its time of day. Series occurrences are not included, since they are not stored until touched.

**Today**: the view of one local day: timed items in that day's range, day-only items on that date, and everything unscheduled.

**Score**: the Today view drawn as parallel staves, one per area, sharing one hour axis. The signature view of Axiis.

**Inbox**: the one name for the pile of open items with no day, as a page (`/inbox`) and as the tray under the Score, the Week and the List. Captured, safe, and never late. Never "Waiting", "unplanned" or "unscheduled" on screen (`unscheduled` is the code's word for the schedule). Dragging an item from the tray onto a staff schedules it.

**Any time**: on a day, at no particular hour (a *day* schedule). Distinct from the Inbox, which has no day at all.

**Passed**: an open timed item whose end is before now. Said in words ("passed") on the Score and counted, never coloured or counted as late.

**At a glance**: the line under a day's, week's or month's title that says where it sits from today and how it stands: "Today · 3 of 10 done · now: Focus block · next: Design sync at 16:00 · 1 due", "This week · 3 days left · 15 open · 2 due · 4 in the Inbox".

**Next up**: the one to three things at the top of Today: happening now, then the next by time, then what is due, then any time.

**Focus**: a per-device switch on Today (cookie `focus`) that shows only now, the next three by time and what is due, and folds the rest of the day into one counted line.

**Due mark**: the one quiet sign of a due date wherever an item is drawn: a small flag and words ("Due today", "Past due", "Due Tue"). The flag is filled once the date has come.

**Tour**: four skippable steps on a new account's Today (capture, the Score, Inbox or Today, the Guide), remembered in the cookie `tour` and replayable from the Guide.

**Capture**: adding an item from one line of text. A plain line lands in the Inbox. On Today, Week, Month, the Inbox and the palette, a day, a time, a length and tags at the line's start or end plan and tag the new task ("dentist tomorrow 9:00 #health"); a checklist captured on Lists keeps its name as typed. Must take under two seconds.

**First day**: the state of an account that has never stored an item of any type or status, deleted ones included. The day screen draws example beams and leaves out what only explains items, until the first capture. An account that once had items never returns to it.

**Soft delete**: setting `deleted_at` instead of removing the row. The app never hard-deletes items; deleting a whole account cascades.

## Rules that are easy to get wrong

- A day is a half-open UTC range computed from the user's time zone. The database stores no "today" and no time zone.
- A row can never point at another user's row. Same-user integrity is a foreign-key property, not a check in app code.
- State is shown by line form (solid, dashed, hollow), never by badge colour. The accent colour means now, drag target or primary focus only.
