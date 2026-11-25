# 0004. Calendar layout: a time grid, a side panel and one top bar

Status: accepted 2026-11-15 (the owner's decisions, recorded as given). Built in stages: the shell and navigation first (branch `calendar-shell`), the time grid in `src/features/calendar/`, then the wiring of the grid into Day and Week.

## Context

The owner found the app confusing to move around in. The day was a horizontal timeline with one lane per area (the Score), the week was seven lists with no time grid, and the switch between Day, Week and Month stood twice: as a segmented control at the top of each view and as the same three places in the rail. They like Google Calendar's flow and layout for planning and want Axiis to work like it, while keeping Axiis's own character rather than becoming a copy.

`docs/ux-navigation.md` and `docs/ux-clarity.md` say why the earlier shape was as it was: the span switch was added so the three calendar views were one step apart, and the rail's groups (Plan, Capture, Library) were named for what a person does. This decision keeps both aims and changes the means.

## Decision

1. **A vertical time grid for Day and Week** (and a three-day span if it is cheap). Hours run down, days are columns, and untimed ("any time") items sit in a row above the grid. Click or drag empty time to create. This retires the horizontal Score inside the app.
2. **Soft colour blocks.** Items are filled blocks tinted with their area's muted colour (the twelve `--area-*` tokens), on Axiis's paper and type. Done items fade and strike.
3. **The side panel** holds, top to bottom: a Create button (it opens capture), a small month (click a day to jump; the days in view are marked), the areas with their colour and a tick each to show or hide them, and fewer, grouped places: Calendar (Day, Week, Month), Tasks (Inbox, Due), Library (Lists, Notes, Tags). Done and Search are reached from the top bar or the palette. The side panel is the only switch between Day, Week and Month: the segmented switch at the top of the views is removed.
4. **One top bar**, in Google Calendar's order: Today, previous and next, the range as the title ("November 2026", "9 to 15 November"), then at the trailing end search, the Guide and the account menu. No control appears twice.
5. **Axiis keeps its own character.** The verdigris "now" line across the grid; the line-form state language as the small mark inside each block (solid live, dashed planned, hollow done) and for the done tick; chalk paper, hairlines, Bricolage Grotesque headings and Hanken Grotesk text; the quiet voice; Next up and Focus as Axiis features (Focus may dim everything but the current block); capture in plain English as the way Create works (a quick popover on the grid, the capture field prefilled with the clicked time, showing the preview words). Not a clone: no Google blue, no Material shadows, no rounded-pill chrome.

### Behaviour expected of the grid

Match Google Calendar unless `PRODUCT.md` forbids it.

- Overlapping items share the column's width side by side; items under 30 minutes stay readable; the grid opens scrolled to now (7:00 on other days); the now line, a dot on today's column, and today's column header marked.
- Drag a block to move it (across days in Week), drag its bottom edge to resize, 15-minute snapping, Escape cancels, an Undo note after. Drag from the any-time row into the grid to time an item and back to untime it. Keyboard: arrows move between blocks and slots, Enter opens, the existing move and resize keys keep working, `[` and `]` step, `T` is today, `D`, `W` and `M` switch span.
- Click a block: a small popover with title, time, area, the done tick, Edit (the existing detail panel) and Delete. Double-click or Enter opens the detail panel directly.
- Click empty time: a quick-create popover at that slot, with the app's default length; dragging empty time draws the length first.
- Repeating items, skipped days, overrides, due marks, subtask counts and tags keep working. Existing commands and server actions are reused, not rewritten.
- Phone (375px): Day is one column; Week shows three days, with arrows and no swipe between days (the product rejected that swipe); the side panel is the existing bottom bar plus a sheet.
- Accessibility: the grid works by keyboard and screen reader, each block a button with a full label ("Standup, Monday 9 November, 9:30 to 9:45, Work, planned"); axe clean in light, dark and at 375px; reduced motion respected.

## How the shell stage built items 3 and 4

- **Places** (`src/components/shell/places.ts`): groups are Calendar, Tasks, Library. Done, which became a page of its own while this was built, sits under Tasks. The Today place is named Day in the panel and the phone bar (`navLabel`), since there it is a span, not a date. From a calendar view the three calendar places keep the day on screen (`spanHrefs`), as the removed switch did; from any other page they open today, this week and this month.
- **The small month** (`mini-month.tsx`): the Month view's grid maths and keys (`monthGrid`, `gridStep`), the reader's week start. A day opens in the span on screen, or as a day from a page that is no calendar view. Days in view sit on a band of Press Tint; today is filled with Ink, as on the Month.
- **Areas**: a tick per area, kept per device in the `hidden-areas` cookie beside the other display choices. Every view's filter carries the hidden ids (`ViewFilter.hidden`, read once per request by `getFilter`), so no view reads anything more. This replaces the rail's area links. An address with `?area=` still shows that one area alone, even an unticked one, with its chip; `?tag=` is unchanged. Items with no area always show.
- **Create** does what `C` does: the page's capture field where it has one, the palette's capture elsewhere.
- **The top bar** (`calendar-bar.tsx`) is one component for the three views. Its title is the page's `h1` and opens the same small month in a popover, with a typed date field under it. Every signed-in page shares one header structure (`page-header.tsx`): the title row with the page's controls at its trailing end and the Guide last, then the summary and filter, then capture on its own row.
- **Search and the account menu stay in the side panel** (the search field under Create, the account row at its foot) rather than moving into the top bar, so they are in one place on every page, including those with no calendar bar. The Guide is at the trailing end of every page's title row.

## How the wiring stage put the grid on the Day and the Week

- **One view, two pages.** `CalendarView` (`src/features/calendar/`) owns the items as they stand, the saves and the status line, and hands a page the grid as a node. The Day (`day-view.tsx`) and the Week (`week-view.tsx`) lay themselves out around it: the calendar bar, the at-a-glance line, capture, then the grid. Each page still does the one bounded read it did (`loadDay`, `loadWeek`), turned into the grid's data by `src/features/calendar/load.ts`; the Week adds one read for subtask counts.
- **The Inbox is a tray under the grid** on both pages, outside what scrolls. An item dragged from it onto a day gets that time, onto Any time that day; a block dragged back loses its day.
- **Three days on a narrow screen.** Below 760px the Week draws three days from the day its address names (`/week` is from today), and the bar's arrows and `[` `]` step three days. The same address on a wide screen shows the whole week holding that day, so a link works on both. There is no three-day place of its own: a span is a route and a place in the panel (`spanHrefs`, `PLACES`), and a fourth would be a second way to see what the Week on a phone already shows.
- **Grid or List.** The Day keeps one switch, Grid and List (`?view=list`). The List is the day as a plain agenda: it reads better than a grid on a day of mostly any-time tasks, and it carries inline rename, the swipes and the Done fold. The Week has no list form.
- **What stayed Axiis.** Next up, Focus (it dims the grid to what is happening now and leaves only Next up beside it), the at-a-glance line, what is left over from earlier days (a quiet strip beside today, never a count in colour), and the week's pulse.
- **Hidden areas say so.** Every page that can be narrowed shows "2 areas hidden" with Show all under its summary (`HiddenAreasNote`).
- **Retired.** The horizontal Score and the week's seven lists, with their drag hooks, styles and harness pages. The landing page now draws the grid too (`src/features/landing/mini-grid.tsx`); its film, which showed the Score, was removed. The placement command and its snapping helpers still live in `src/features/score/`.

## Consequences

- `SpanSwitch` and the Month's "Jump to month" picker are gone; the small month and its typed date replace both date pickers and the month picker.
- The panel is taller than the rail was. It scrolls between its top and the account row, which stays in view.
- Hiding an area hides its items everywhere on that device. A quiet line under each page's summary says how many are hidden and offers to show them all.
- A hard load of the Week on a phone draws seven columns until the page wakes, then three: the server cannot know the width. A page reached from inside the app is right from the start.
