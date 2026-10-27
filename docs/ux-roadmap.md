# Acting on items where they are drawn

The owner asked for icons on a task under the pointer, "so it is more efficient for deleting, editing, etc., instead of clicking each one and waiting for the sidebar to open." This is the plan for that, in two rounds: quick actions first, then a round of visual polish drawn from how Apple's apps feel. `docs/ux-clarity.md` answered "where am I", `docs/ux-navigation.md` "how do I get somewhere"; this answers "how do I change something without opening it".

Decided with the owner before the work began:

- Swipe actions on a phone are wanted, with Undo.
- Quick actions first, visual polish in a later round.
- The Score's identity stays: ink on warm paper, line forms for state, Verdigris only for now, a drag target and focus.

## What it costs today

Every change but a tick goes through the detail panel. Renaming a task is a click on its title, a wait while the address changes and the panel's server render arrives (300 to 500 ms on the production build, more on a phone), a click into the title field, typing, Enter, then Escape to close. Deleting is the same wait, a scroll to the panel's foot, Delete, then Yes. Planning from anywhere but the Inbox is the panel's When row. Clearing six stale tasks from Today is six round trips through the panel. The tick already works in place everywhere, which shows the shape the rest should take.

## Round one: quick actions

One shared component, `RowActions`, reused on every surface that draws an item, so an action looks and works the same wherever it is met. Every action reuses a command the detail panel already uses, so the rules (an occurrence stores an override on first touch, a note has no day, an event cannot hold subtasks) live in one place.

**The actions.**

| Action | What it does | Command |
|---|---|---|
| Done | Ticks it, or opens it again. The row's own done box where it has one. | `setDone` |
| Rename | Edits the title where it is drawn. Enter saves, Escape cancels, an empty title keeps the old one. | `renameItem` |
| Plan | Today, Tomorrow, Next week, Pick a date, and a time once it has a day. No day takes it back to the Inbox. | `planItem`, `moveItem`, `setTime`, `clearTime` |
| Area and tags | The area swatches and the tag chips, as in the panel. | `setItemArea`, `addTag`, `removeTag` |
| Delete | Gone at once, with Undo for six seconds (Ctrl Z or ⌘Z). An occurrence asks: skip this day, or delete every time. | `deleteItem`, a new `restoreItems`, `restoreOccurrence` |
| More | Duplicate, Make an event or Make a task, Move to the Inbox, Open details. | a new `duplicateItem`, `setType`, `moveItem` |

**Where it appears.** Today's List rows, the Score's beams and chips, the Week's rows, the Month's marks (Done and More only, since a mark is one line of a small cell), the Inbox, Due, Lists, the Notes list, a tag's page, Search results and Next up.

**Ways in, for every hand.**

- A pointer resting on a row, or focus inside it, shows the cluster at the row's end. It takes room that is already reserved, so nothing moves when it appears.
- A right-click on a row opens the same actions as a menu at the pointer. Escape closes it and focus goes back to the row.
- With a row in focus, keys: E renames, P plans, D ticks, Delete or Backspace deletes (with Undo), `.` opens More. They are in the shortcuts table, the Guide and the palette.
- On a touch screen the hover cluster is hidden, and each row keeps one 44px overflow button that opens the same menu, so nothing needs a gesture.

**Saving.** Each change is drawn at once and rolled back if the save fails, with the failure said in the undo note's place. Saves go through `reach()`, so a lost connection is a sentence, not an error page.

**Series.** A row may be one occurrence of a series that is not stored yet. An action on it stores the override first, as the panel does. Delete on an occurrence never deletes the series without asking: the cluster's Delete asks "Skip this day" or "Delete every time", and a series' own row (on Lists, a tag's page, Search) asks before deleting all of it.

**The Score.** Beams already drag, resize and answer arrow keys. The cluster sits above a beam's label only while the beam is hovered or focused, never on the resize grip, and takes no pointer events outside its own buttons, so a drag that starts on the beam is a drag.

### Phases (each its own pull request, stacked)

- **A. Groundwork.** This plan, and the interaction tokens in DESIGN.md (springs and easing, how a popover and a menu are drawn, hover and pressed states, the cluster's spec).
- **B. Row actions.** The component, the two new commands, every surface, the context menu, the keys, the docs.
- **C. Popovers and rename, shared and checked.** One popover and one menu behaviour (native `popover`, focus in and back, Escape, arrows, outside click), names that hold the visible words (WCAG 2.5.3, `src/features/today/item-name.ts`), axe clean in light, dark and on a phone.
- **D. Phones, then many at once.** Swipe right on a row to tick it, swipe left for Plan and Delete (with Undo), a long press for the menu; only on list rows (List, Inbox, Due, Lists), never on the Score, whose axis scrolls sideways. Reduced motion respected. Then multi-select: Shift or Cmd click, or Select on a touch screen, and a floating bar (Done, Plan, Area, Tag, Delete with Undo) that says how many; Escape clears.

Status: A to D are built. On a touch screen the row does not slide under the finger: a strip grows from the edge it left, so nothing under the finger jumps; a slide of the whole row is left to the polish round. Choosing many rows is said "chosen", since "selected" already means the item open in the panel. Earlier notes on B: Where B differs from this plan: Delete and Backspace keep their meaning on the Score and the Week (back to the Inbox, as the Guide has long said), so deleting there is the cluster, the menu or the panel; Week rows and Month marks carry Done and More only, since a day column is too narrow for six buttons; a Plan from the cluster is not drawn ahead of the save, since whether the item leaves the page depends on the page.

Gates for each: no new migration; first-load JS at most 5 KB gzipped more per route (`scripts/bundle-sizes.mjs`); unit tests for every command and pure module; one e2e spec per phase (hover, keys, right-click, Undo, an occurrence, drag still working, axe in light, dark and on a phone); captures at 1440 and 375 in both themes.

## Round two: visual polish, after Apple's apps

Built as phase E (stacked PRs, Today and the Week first) and phase F (a dark, performance and accessibility pass, which cut the glass blur to 10px). E1: raised cards, glass bars and a press that gives (DESIGN.md, Raised cards and bars). E2: large titles that fold into a sticky glass bar. E3: segmented controls with a sliding thumb. E4: rows that move instead of jumping. Still open from the list below: menus that grow from their trigger, a symbol set on one grid, a row that folds up after a tick (it now fades where it stood), and the polish on Inbox, Due, Lists and the Month. Each item names what it borrows and the rule it must keep.

- **Springs for things that move under a hand.** A dragged beam settling, a swiped row snapping back, a popover arriving, on the spring set in DESIGN.md (Interaction tokens). Colour and opacity keep their 140ms ease.
- **Menus that grow from where they were opened.** A menu scales in from its trigger's corner (0.96 to 1) instead of only rising, as on macOS. A context menu grows from the pointer.
- **Materials for floating layers.** The popover, menu and bulk bar could use a translucent Sheet with a backdrop blur over the page, kept to one strength, and only where the content under it is still legible at 4.5:1. Rows and the Score stay flat paper.
- **Completion moment.** The done sweep is the moment; a row that leaves after a tick could fold up over 240ms on the house curve rather than vanish, as Reminders does.
- **Symbols.** One stroke weight and one optical size for every icon in the clusters and menus, drawn on a 16px grid like SF Symbols at small scale, so the cluster reads as one family.
- **Haptic-feeling feedback on touch.** A swipe that crosses its threshold snaps its action icon to full size (no vibration API), as Mail does.
- **Typography in menus.** 14px rows, 13px key hints right-aligned in Ink Quiet, separators as Hairline Soft rules, a destructive row in Ink with its icon, never red.

Each needs its own captures and the reduced-motion check. None may add a hue, a shadow on a row, or Verdigris outside now, a drag target and focus.

## Left out, on purpose

- **Hover cards that preview an item.** They would cover the Score, which the Guide's "Never beside content" rule keeps clear.
- **Drag to reorder rows in the lists.** Order comes from time and the server's rules; a manual order is a data-model change.
- **Undo for every panel change.** The undo note covers changes that move something out of sight (a plan, a tick in the Inbox, a delete); a rename or an area change stays where it was made and can be changed back there.
