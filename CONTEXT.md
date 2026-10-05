# Axiis

A solo productivity web app. One connected set of items, shown through many views.

## Glossary

**Item**: the single unit of content. Everything the user captures is an item: a task, an event, a note or a checklist. Never "todo", "entry" or "card".

**Type**: what kind of item it is. `task`, `event`, `note`, `checklist`. A type changes how an item is drawn and what it may do (a note has no schedule), not which table it lives in.

**Area**: one of the user's parts of life, such as Work, Home or Health. Shown as a staff on the Score. Never "category", "project" or "list".

**Schedule**: where an item sits in time. Exactly one of *unscheduled*, *day* (planned for a date, no time) or *timed* (a start and an end). Distinct from the **due date**, which is a deadline and independent of the plan.

**Subtask**: an item whose parent is another item. At most two levels. A checklist is a parent whose children are small; a checklist line can be promoted to a task.

**Link**: a typed edge between two items, such as a note referencing a task. Backlinks are links read in reverse.

**View**: a query over items, never its own data. Score, List, Week and Today are views.

**Today**: the view of one local day: timed items in that day's range, day-only items on that date, and everything unscheduled.

**Score**: the Today view drawn as parallel staves, one per area, sharing one hour axis. The signature view of Axiis.

**Tray**: the "Waiting for a time" list of unscheduled items on the Score. Dragging an item from the tray onto a staff schedules it.

**Capture**: adding an item with nothing but a title. It lands unscheduled in the tray. Must take under two seconds.

**Soft delete**: setting `deleted_at` instead of removing the row. The app never hard-deletes items; deleting a whole account cascades.

## Rules that are easy to get wrong

- A day is a half-open UTC range computed from the user's time zone. The database stores no "today" and no time zone.
- A row can never point at another user's row. Same-user integrity is a foreign-key property, not a check in app code.
- State is shown by line form (solid, dashed, hollow), never by badge colour. The accent colour means now, drag target or primary focus only.
