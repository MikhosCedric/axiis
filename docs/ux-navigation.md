# Moving around Axiis

The owner asked for "better navigation and UX". `docs/ux-clarity.md` answered "where am I"; this answers "how do I get somewhere, and how do I finish a common job". It is the diagnosis behind the `ux-navigation` branch, then what it changed.

## How it was looked at

The browser-test build (`AXIIS_E2E_BUILD=1`, `docs/e2e-session.md`) served on port 3710 with the `busy` fake account (`axiis-e2e-account=busy`), captured at 1440 and 375 in light and dark on every signed-in page, and driven with a small Playwright probe for the things a screenshot cannot show: what Escape and the browser's Back do with the detail panel open, what `c` does on a page with no capture field, where focus lands after a route change, what the empty palette offers. The captures are not committed; they sit in the agent's scratchpad (`before/` and `after/`, `<page>-<width>-<theme>.png`).

## Candidates checked and dropped

Each candidate in the brief was checked against the running app before anything was built.

- **Skip link, landmarks, announced titles.** Already there: a "Skip to content" link to `#main`, one `main`, a `nav` per rail and per step row, one `Details` landmark, and Next's route announcer reads each new title ("Week of 19 October 2026 · Axiis"). Nothing to do.
- **Breadcrumbs on drilled-in pages.** A note has "All notes" and a tag page "All tags" at the top; a missing note or tag links back too. Nothing to do.
- **Prefetching.** Next links prefetch when they enter the viewport in a production build, which covers the day and week steps and the rail. The Month's neighbours wait for a hover or focus on purpose (a month load is the heaviest read). Nothing to do.
- **Dates and tags in the palette.** "next friday", "nov 3", "in 2 weeks", "2026-12-24", "nov 2026" and `#tag` already jump. Items are searched as you type and each result has actions (open, done, plan today or tomorrow, tag).
- **Swipe between days and weeks.** Dropped. The Score scrolls sideways inside itself on a phone, so a horizontal swipe on the day would fight the axis, and a swipe that works on the Week but not the day is a rule nobody can guess. The Previous and Next pair is already one 44px control in the head.
- **Week opening at today on a phone.** Kept out, as `ux-clarity` decided: scrolling past Monday hides the at-a-glance line. A link to today's column is built instead (below).

## Friction, ranked

Ranked by how often the job comes up times how much it costs each time.

1. **Clearing the Inbox is slow and silent.** Each item takes three moves (Plan for, then a day, then the next row's Plan for), the only days offered are Today, Tomorrow and a native date field, nothing works from the keyboard beyond Tab, and the news of a plan lands in the status line at the top of the page, far from the row, with no way back. A misplaced tap means finding the item on another day and moving it again. Clearing four items felt like work, not like relief.
2. **The panel ignores Escape and Back.** With an item open from the Inbox, Due, Lists or a tag page, Escape does nothing (only the Score, Week and Month rows listen, and only while the row has focus). The browser's Back skips the panel and leaves the page, because opening an item replaces the address instead of adding to it. On a phone, where the panel stacks under the page, Back is the gesture people reach for first.
3. **Day, Week and Month do not share one switch.** Today and the Week carry a Day/Week pair; the Month has none, so going from the Month to its week or day means the rail. The pair never mentions Month, so the three views read as unrelated places rather than three zooms of one calendar.
4. **No undo for a plan or a tick in the Inbox.** A done tick can be unticked while the row stays, but a plan cannot be taken back from where it was made.
5. **Capture is not everywhere.** `c` focuses the capture field on Today, Week, Month and the Inbox, and does nothing on Due, Lists' rows, Notes, Tags, Search or Settings. The palette captures, but only once you know Ctrl K does that.
6. **The empty palette is a list of pages.** It shows the eleven places and the Guide. It does not say which places have a key (G then T, and so on), and it forgets where you just were, so going back to the note or tag page from a minute ago means typing its name again.
7. **The Week on a phone hides today.** On a Friday today is four screens down, with nothing in the head to jump there.

## What changed

On `ux-navigation`, one commit per step:

- See the log entry in `docs/PROGRESS.md` (2026-10-23, navigation) for the list of what landed and its tests.

## Left out, and why

- **Swipe between days and weeks**, for the reason above.
- **Undo for delete.** Deleting already asks to confirm in the panel, and taking it back needs a restore command that sets `deleted_at` back to null on both repos; that is its own change.
- **Fuzzy jump to areas.** Areas are not pages (the rail's readout counts them), so there is nowhere to jump to; the area filter belongs to the `feat-colors-filters` branch.
