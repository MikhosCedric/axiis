# Design audit, 6 October 2026

A read-only `impeccable audit` of the shipped UI against [`DESIGN.md`](../DESIGN.md). Each finding names its severity, where it lives, the evidence, and a suggested fix. The audit itself fixed nothing. The fixes came later on `fix-audit` (PR #22), and each finding's **Status** line says whether it was fixed or deferred, and why.

## How it was checked

- **Pages.** `/` (landing), `/dev/score`, `/dev/detail`, `/dev/inbox`, `/dev/lists`, `/dev/tags`, on `next dev` at commit `250dfb2`.
- **Matrix.** 1280×860 desktop and 375×812 mobile (touch, mobile UA), each in light and dark, in Microsoft Edge driven by Playwright. 24 page loads in all.
- **Per load.** axe-core with the WCAG 2.0 to 2.2 A and AA tags. A computed-style probe for text contrast (composited over every translucent ancestor and multiplied by ancestor opacity), targets under 24px and under 44px, horizontal overflow, landmarks and headings. A full-page screenshot.
- **Interactions.** Opening an item in the detail harness at both sizes, Escape back, the Tab order on the Score, selecting a row in the Score's List view, and the landing playhead under `prefers-reduced-motion`.
- **Performance.** A production build (`next build`, `next start`) of `/`, `/privacy` and `/login` at 375px, measured locally and unthrottled. The dev harnesses are blocked in production, so they were not measured this way.
- **Detector.** `impeccable detect src` returns nothing once `DESIGN.md` lists the shipped type steps.
- **Not exercised.** The touch long-press drag on beams was not synthesized. Its handling (a 280ms hold, `pointercancel`, a non-passive `touchmove` guard) was read in `src/features/score/use-score-drag.ts` only.

axe reported **no violations on any of the 24 loads**, nor with the detail panel open. Every finding below came from the probe, the screenshots or the code.

## Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Ink Quiet on Verdigris Wash is 4.19:1 in a selected List row |
| 2 | Performance | 4 | CLS 0, no long tasks, JS is the framework baseline |
| 3 | Responsive | 2 | Below 1180px the detail panel opens out of view |
| 4 | Theming | 3 | Tokens throughout; dark values are declared twice |
| 5 | Implementation integrity | 3 | Coherent system; the landing copy is out of date |
| | **Total** | **15/20** | **Good** |

**Integrity verdict: pass.** The app expresses one specific system everywhere: ruled staves, line-form state (dashed, solid, hollow), verdigris for now, Besley and Hanken, tabular time. The lists' progress rule (solid for done lines, dashed for the rest) extends the same language rather than adding a new one. The drift is small and named below.

## Findings, in order

1. **[P1, Responsive] Below 1180px the detail panel opens out of view.**
   - **Where.** `src/features/detail/detail-aside.tsx`, placed by `src/features/day/day-view.tsx:180-235`. The same stacking shows in `/dev/detail`.
   - **Evidence.** At 375×812, clicking "Task with subtasks, some done" renders the `<aside aria-label="Details">` at y=771, 1024px tall. Only its Close button peeks above the fold, and focus stays on the list link. In the day view the aside stacks after the whole Score, the key help and the tray, so on a phone or a tablet up to 1179px wide, tapping a beam appears to do nothing.
   - **Fix.** Below 1180px, present details as a sheet over the day (a `<dialog>` or bottom sheet, as the palette already is). At the least, scroll the aside into view and move focus to its title on open, then return focus to the beam on close. Suggested command `/impeccable adapt`.
   - **Status. Fixed (the lesser fix).** Opening an item scrolls the panel into view and focuses it, and closing returns focus to the opener. `e2e/harness.spec.ts` checks this at 375px from a list row and from a beam. A sheet over the day remains a design option.

2. **[P1, Accessibility] Quiet text in a selected Score List row fails AA contrast.**
   - **Where.** `src/features/score/list-view.tsx:61` (Any time or Waiting), `:101` (the area name) and `:15` (done rows), all on the selected row's `bg-accent-wash`.
   - **Evidence.** In `/dev/score` List view with "Design sync" selected, the area label "Work" is `rgb(98, 94, 85)` at 13px on `rgba(10, 103, 90, 0.14)` over Music Paper. That is 4.19:1 against the 4.5:1 that WCAG 1.4.3 requires. Dark mode is 4.67:1 and passes. Inbox and Lists already swap Ink Quiet for Ink Secondary on selection (`inbox-view.tsx:212`, `lists-view.tsx:83`); the Score's List view does not.
   - **Fix.** Apply the same `selected ? "text-ink-2" : "text-ink-3"` swap in `list-view.tsx`. Suggested command `/impeccable polish`.
   - **Status. Fixed.** The selected row uses Ink Secondary for Any time, Waiting, done titles, the area name, the repeat mark and the tags. Re-measured with the same probe: every text on the selected row is now at least 6.0:1 in light and 6.78:1 in dark, where Work, Waiting, Any time, the tags and a done title were 4.19:1. `e2e/a11y.spec.ts` now runs axe on the List view with a row selected, and fails on the old colours.

3. **[P1, Implementation integrity] The landing page lists shipped features as coming.**
   - **Where.** `src/app/page.tsx`: the `COMING` array and the third "How it works" measure.
   - **Evidence.** "Coming" lists "Repeating tasks", "Tags" and "A command palette". All three ship (`src/features/detail/repeat.ts`, `src/features/tags/`, `src/features/palette/`). The third measure says "Notes that link to your tasks come next", while "What it does today" already lists "Notes that link to tasks, and search across both". Lists and the Inbox appear nowhere. The surface brief requires the page to claim only what ships, so understating counts too.
   - **Fix.** Move the three items into `NOW`, add Lists and the Inbox, rewrite the measure's last sentence, and decide whether "Coming" still has anything to list. Suggested command `/impeccable clarify`.
   - **Status. Fixed.** "What it does today" now lists repeating tasks, the Inbox, Lists, tags and the command palette, set in two columns from 820px. The third measure says an open item shows its linked notes. "Coming" is gone, since nothing unshipped is promised. `e2e/public.spec.ts` checks the shipped lines and the absence of "Coming" and "come next".

4. **[P2, Accessibility] Beam labels collapse, and the playhead strikes through them.**
   - **Where.** `src/features/score/score-view.tsx:398` (the label's `maxWidth: labelWidth(beam.free)`) and `:269-275` (the playhead, `z-[3]`).
   - **Evidence.** At 1280px in `/dev/score`, the 15:00 "Quick check-in" label renders as a single "Q", "Stand-up" as "Sta…" and "Plan the Lisbon trip" as "Plan the …". The 2px verdigris playhead is drawn over the label text of "Review pull requests", "Design sync 13:00" and "Inbox, now". The full title remains in `aria-label` and `title`, so this is a sighted-reader problem.
   - **Fix.** Below a minimum width (for example 4ch), show the start time alone or move the label up a row. Give labels a paper halo (`text-shadow` or a `--paper` background) so the playhead passes behind the words, not through them. Suggested command `/impeccable polish`.
   - **Status. Deferred.** Choosing between a time-only label and a second label row changes how the Score reads, which is a design call.

5. **[P2, Responsive] Touch targets are mostly 32px, and short beams are 19px wide.**
   - **Where.** Icon buttons (`size-8`, 32×32) in `detail-sheet.tsx:25`, `subtasks.tsx:140`, `connected.tsx:160` and `areas-section.tsx:40`. Quarter-hour beams in `score.module.css` (`.beam`, 25px tall). The resize grip (12px, or 24px under `pointer: coarse`).
   - **Evidence.** In the detail panel at 375px, all 24 controls measure under 44px. Make-item and Delete sit side by side at 32×32. Four beams in the fixture measure 19×25, under WCAG 2.5.8's 24px minimum in width. The other controls pass 2.5.8 through spacing but fall short of the 44px touch guidance.
   - **Fix.** Under `@media (pointer: coarse)`, enlarge hit areas with a transparent `::before` (44px for icon buttons, at least 24px wide for beams) without changing the drawn glyph. Suggested command `/impeccable adapt`.
   - **Status. Icon buttons fixed; beams deferred.** Under a coarse pointer the six 32px icon buttons (detail header, subtasks, delete, unlink, areas, the note toolbar) grow to 44px, so Make-item and Delete no longer sit as a 32px pair. They grow rather than gain an overlapping `::before`, so neighbouring targets never share a hit area. Mouse sizes are unchanged. A tag chip's remove button stays 24px, the 2.5.8 minimum, to keep chips compact. `e2e/harness.spec.ts` measures every icon button in the detail panel on a touch phone, and fails on the old sizes. **Beams are deferred.** On touch the 24px resize grip already covers most of a quarter-hour beam, so a wider beam needs a call on how a short beam splits picking up from resizing.

6. **[P2, Implementation integrity] Verdigris Wash is also the hover colour for 41 controls.**
   - **Where.** `hover:bg-accent-wash` appears 41 times in 25 files, among them `nav-rail.tsx`, `detail-sheet.tsx`, `subtasks.tsx`, `inbox-view.tsx`, `rich-text.tsx` and `palette.tsx`.
   - **Evidence.** The same 14% verdigris fill marks a selected row, a drop target under a drag, and every hovered link or icon button. A pointer resting anywhere puts verdigris on screen, which works against the Now Rule (verdigris means now, a drag target, or the focused or selected thing).
   - **Fix.** Add a neutral hover token, such as `--hover: rgba(28, 27, 34, 0.06)` and its dark twin, or reuse Rail Paper as the public header already does. Keep the wash for selection and drop targets. Suggested command `/impeccable quieter`.
   - **Status. Fixed later (`ui-refine-3`).** Hover is a neutral ink tint (`--hover`, 6% ink, 7% paper in dark) with a pressed step (`--press`), on all 46 controls that had the wash. The wash is left only on selected rows, drop targets and the active palette option. The rail's current Settings link and the "Changes apply to" segment moved from the wash to an Ink fill, as the Ink-for-Selection rule asks.

7. **[P2, Responsive] Touch devices get keyboard instructions and no hint to press and hold.**
   - **Where.** The key help paragraph in `score-view.tsx:280-285`, the `C` key hint in `capture-field.tsx:70-75`, and the tray copy at `score-view.tsx:295-297`.
   - **Evidence.** At 375px with touch, the Score shows four lines of arrow-key, Shift, Space and Backspace instructions, and the capture field shows a `C` key. Picking a beam up by touch needs a 280ms hold (`LONG_PRESS_MS`), but the copy says only "Drag a beam".
   - **Fix.** Under `(pointer: coarse)`, swap the paragraph for "Press and hold a beam, then drag it" and hide the `kbd` hints. Keep the paragraph as the `aria-describedby` text for keyboard users. Suggested command `/impeccable clarify`.
   - **Status. Fixed.** Under a coarse pointer the Score shows "Press and hold a beam, then drag it to move it, or hold and drag its right end to change its length", the tray says to press and hold one before dragging it onto an area, and the capture field's `C` is hidden. The key help becomes visually hidden but stays every beam's description. `e2e/harness.spec.ts` checks both the touch and the mouse copy.

8. **[P2, Accessibility] The note body hides its focus ring.**
   - **Where.** `src/features/notes/editor.module.css:11-13` (`.prose:focus-visible { outline: none; }`).
   - **Evidence.** This is the one place the global 2px verdigris `:focus-visible` ring is removed. A keyboard user tabbing from the title into an empty body sees only a caret, which is easy to miss in a 68ch field.
   - **Fix.** Replace the outline with a quieter cue that still shows focus, such as a 2px verdigris rule on the left edge or the Field Stroke border used by inputs. Suggested command `/impeccable polish`.
   - **Status. Fixed.** A focused note body draws a 2px verdigris rule down its left edge, hung 14px into the margin so the text does not move. `e2e/harness.spec.ts` tabs into the body at 375px and checks the rule appears and stays on screen.

9. **[P3, Theming] Dark tokens are declared twice.**
   - **Where.** `src/app/globals.css:20-52`.
   - **Evidence.** The 12 dark values appear once under `[data-theme="dark"]` and again under `prefers-color-scheme: dark`, held together by a "Keep in sync" comment. They match today.
   - **Fix.** Declare each token once with `light-dark()` and let `color-scheme` pick the theme. Set `color-scheme: light dark` on `:root`, then force `light` or `dark` from `data-theme`. Suggested command `/impeccable polish`.
   - **Status. Deferred.** The values match today, and moving every token to `light-dark()` changes how themes are forced, so it wants its own change and a decision on browser support.

10. **[P3, Implementation integrity] The page-title style is copied as a literal 10 times.**
    - **Where.** `font-serif text-[clamp(28px,3vw,40px)] leading-[1.1] font-medium tracking-[-0.015em]` in `day-view`, `week-view`, `inbox-view`, `lists-view`, `notes-list`, `search-view`, `settings-view`, `tag-index-view`, `tagged-view` and the detail harness. `note-editor.tsx:148` has already drifted to `3.2vw` and `1.15`.
    - **Fix.** Add one `@utility headline` (and `title`) in `globals.css` matching the Headline token in `DESIGN.md`, then use it everywhere. Suggested command `/impeccable typeset`.
    - **Status. Deferred.** Whether the note title's drifted `3.2vw` and `1.15` are kept or folded in is a type decision, and the sweep touches ten screens, so it belongs in its own change.

11. **[P3, Accessibility] Chip and outline-button edges are faint.**
    - **Where.** `.chip` in `score.module.css`, `quietAction` in `site-chrome.tsx`, and the outline buttons in Inbox and Settings, all bordered by Hairline.
    - **Evidence.** Hairline on Music Paper is 1.79:1 in light and 2.39:1 in dark, under the 3:1 that WCAG 1.4.11 sets for a component boundary. Each control is still identified by its text and glyph, so this is not a strict failure. But a draggable chip is something you aim at, and its edge is what you aim for.
    - **Fix.** Draw resting chips with Field Stroke (3.68:1 on Sheet) or move them to Rail Paper. Keep Hairline for rules that separate content. Suggested command `/impeccable polish`.
    - **Status. Deferred.** Field Stroke or Rail Paper are two different looks for every chip and outline button, which is a design call.

## Shell critique follow-ups, 7 October 2026

A later `impeccable critique` of the signed-in shell (`.impeccable/critique/2026-10-06T19-17-33Z__localhost.md`, 26/40) was answered on `fix-critique-shell` (PR #28).

- **Phone width (P1). Fixed.** The nav no longer widens the page at 375px, and Settings and Sign out stay on screen. `e2e/shell.spec.ts` checks `scrollWidth` in light and dark.
- **One pile, four names (P2). Fixed.** The pile of items with no day is "Waiting" everywhere, and the Score and Week trays link to the Inbox, which holds the same items.
- **Vocabulary never taught (P2). Fixed.** The Score and Week print a one-line key beside the "?" hint: planned dashed, happening solid, done hollow, and on the Score the now line. Tag pages and Lists now tick an item done from its glyph, through the same `DoneToggle` as the Inbox, named "Done: <title>". A series and a note have no tick. `e2e/vocabulary.spec.ts` covers both.
- **Small consistency items. Fixed.** The Tags index starts at the same left edge as Lists. The rail's Areas read as a quiet readout (13px, Ink Quiet, tighter rows) rather than as links. Today has its own icon (one framed day with a beam) instead of a cross that read as "+". Inbox, Lists, Tags, Notes, Search and Settings load with a neutral heading-and-rows skeleton instead of the Score's staves.
- **Week date focus ring. Not reproduced in Chromium.** In Edge the old field already drew the 2px ring on click and on Tab. The field now also draws it through `focus-within`, for engines that focus the inner date segments rather than the field. That case was not checked in Safari or Firefox.
- **Touch targets. Fixed.** Under a coarse pointer, the Score/List and Day/Week switches are 44px tall. The landing header's Sign in and theme toggle and the footer links are 44px tall at every size.

## Harness-only notes

These are not shipping defects. The harness pages have no `<main id="main">`, so the root layout's "Skip to content" link has no target there, while the real `(app)` layout provides one. Each harness has a 13px "Make saves fail" checkbox. The Next dev indicator overlaps the bottom-left of every page in dev.

## What works

- **Line-form state holds everywhere.** Beams, chips, inbox rows, list progress rules and the detail header all draw planned as dashed, live as solid verdigris and done as hollow. Type is shown by the head's shape, with no hue.
- **Keyboard and screen readers.** Every beam and chip is a focusable `role="button"` with a full spoken label (title, time, area, state, repeats, subtask count, tags) and a shared `aria-describedby` key help. The Tab order on the Score follows reading order, focus returns to the opener on Escape, and the global 2px verdigris ring renders on every stop checked. The landing sample score is `aria-hidden` but has an `sr-only` list of the same items.
- **Reduced motion is honoured, not killed.** The landing playhead does not animate under `reduce` (no running animations), the done sweep and beam glides drop out, and view transitions are disabled. State is still shown.
- **Dark mode passes on its own terms.** Every text pair measured passes AA in dark, and axe found nothing in either theme.
- **Performance.** Measured on the production build at 375px, locally and unthrottled, so these are not field numbers. The landing has CLS 0.000, an LCP (the H1) at 484ms and no long tasks. It loads 152 KB of compressed JS, the same as `/privacy` and `/login`, so that is the shared Next and React baseline rather than landing code. Fonts are 71 KB for three faces, self-hosted through `next/font`. Drags write `transform` and `left` only on the dragged element, with a `pointercancel` cleanup.
- **No horizontal page overflow** at 375px on any page. The Score scrolls inside its own container, and the landing sample score narrows its window of hours instead of scrolling.

## Recommended order

1. **[P1] `/impeccable adapt`.** Make the detail panel a sheet below 1180px (finding 1), then enlarge touch hit areas (finding 5).
2. **[P1] `/impeccable polish`.** Fix the Score List view contrast (finding 2).
3. **[P1] `/impeccable clarify`.** Update the landing page's shipped and coming lists (finding 3), then the touch copy (finding 7).
4. **[P2] `/impeccable quieter`.** Give hover a neutral token (finding 6).
5. **[P2] `/impeccable polish`.** Beam labels and the playhead (finding 4), the note focus cue (finding 8), chip edges (finding 11), the dark-token duplication (finding 9).
6. **[P3] `/impeccable typeset`.** One headline utility (finding 10).
7. **`/impeccable polish`** as the final pass.
