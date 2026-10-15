---
name: Axiis
description: Tasks and time on one page, drawn as a score on warm music paper.
colors:
  music-paper: "#ebe4d4"
  rail-paper: "#e2dac6"
  sheet: "#f3eee1"
  engraving-ink: "#1c1b22"
  ink-secondary: "#4a4741"
  ink-quiet: "#625e55"
  hairline: "rgba(28, 27, 34, 0.28)"
  hairline-soft: "rgba(28, 27, 34, 0.12)"
  field-stroke: "rgba(28, 27, 34, 0.55)"
  verdigris: "#0a675a"
  verdigris-wash: "rgba(10, 103, 90, 0.14)"
  hover-tint: "rgba(28, 27, 34, 0.06)"
  press-tint: "rgba(28, 27, 34, 0.11)"
  on-verdigris: "#f3eee1"
  scrim: "rgb(8 7 10 / 0.48)"
  night-paper: "#14131a"
  night-rail: "#0e0d13"
  night-sheet: "#1f1e27"
  night-ink: "#ece5d3"
  night-ink-secondary: "#bdb7a8"
  night-ink-quiet: "#9d978a"
  night-hairline: "rgba(236, 229, 211, 0.3)"
  night-hairline-soft: "rgba(236, 229, 211, 0.12)"
  night-field-stroke: "rgba(236, 229, 211, 0.5)"
  night-verdigris: "#45c7b0"
  night-verdigris-wash: "rgba(69, 199, 176, 0.16)"
  night-hover-tint: "rgba(236, 229, 211, 0.07)"
  night-press-tint: "rgba(236, 229, 211, 0.12)"
  on-night-verdigris: "#10201d"
typography:
  display:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "clamp(2.6rem, 1.4rem + 5.2vw, 5.25rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "clamp(28px, 3vw, 40px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  headline-public:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "clamp(1.6rem, 1.2rem + 1.4vw, 2.25rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.015em"
  headline-legal:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "clamp(2.2rem, 1.6rem + 2.4vw, 3.25rem)"
    fontWeight: 500
    lineHeight: 1.08
  title-large:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.2
  title:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.25
  staff-name:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.2
  staff-name-wide:
    fontFamily: "Besley, Georgia, serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.2
  lead:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  reading:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  body-large:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.88em"
    fontWeight: 400
  body:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 20px
  caption:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "tnum"
  overline:
    fontFamily: "Hanken Grotesk, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  hairline: "2px"
  focus: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  dialog: "12px"
  pill: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "14": "56px"
  "24": "96px"
  "32": "128px"
  hour: "76px"
  staff-line: "6px"
components:
  button-primary-public:
    backgroundColor: "{colors.verdigris}"
    textColor: "{colors.on-verdigris}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-quiet-public:
    textColor: "{colors.engraving-ink}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-ink:
    backgroundColor: "{colors.engraving-ink}"
    textColor: "{colors.music-paper}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-outline:
    textColor: "{colors.engraving-ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-icon:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    size: "32px"
  input-capture:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.engraving-ink}"
    rounded: "{rounded.lg}"
    padding: "10px 40px 10px 14px"
  chip-item:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.engraving-ink}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  nav-link:
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "8px"
  nav-link-current:
    backgroundColor: "{colors.engraving-ink}"
    textColor: "{colors.music-paper}"
    rounded: "{rounded.md}"
    padding: "8px"
  now-flag:
    backgroundColor: "{colors.verdigris}"
    textColor: "{colors.on-verdigris}"
    rounded: "{rounded.sm}"
    padding: "4px 6px"
  dialog-palette:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.engraving-ink}"
    rounded: "{rounded.dialog}"
    width: "min(560px, calc(100vw - 32px))"
---

# Design System: Axiis

## Overview

**Creative North Star: "The Day as a Printed Score"**

Axiis draws a day the way an engraver sets a page of chamber music. Each area of life (Work, Home, Health) is a staff of five faint ruled lines. One hour axis runs across every staff, with a barline on each hour and a double barline where the day ends. Items are beams laid on those lines, and their line form, not a colour, says where they stand: dashed while planned, solid while happening, hollow once done. A single verdigris playhead marks now.

The surface is warm music paper in light and a deep ink-blue night in dark, both on one set of shared tokens, each declared once as `light-dark(day, night)`. Depth comes from hairlines and tonal paper steps, almost never from shadow. Type pairs Besley, a bookish serif with high contrast, for headings, staff names and the wordmark, with Hanken Grotesk for everything a hand operates. The interface is quiet by default and spacious, and its one loud moment is the colour of now.

This is the incumbent system as shipped in `src/app/globals.css`, `src/features/**` and `src/components/**`, extracted from code. It rejects the blank-canvas SaaS look, blue or purple gradients, guilt badges and per-type colour coding.

**Key Characteristics:**
- One hour axis shared by every area, read left to right.
- State is drawn as line form; colour is reserved.
- Verdigris appears only for now, a drag target, the focused or selected thing, and the one public call to start (Start with today).
- Engraved hairlines and paper tones carry structure; shadows are rare and functional.
- Serif for what you read, sans for what you operate, tabular figures for every time and count.

## Colors

A two-ink, one-pigment palette: warm paper, near-black ink in three strengths, and a single verdigris that is spent sparingly.

### Primary
- **Verdigris** (`verdigris`, dark `night-verdigris`): the colour of now. It fills the playhead line, the clock flag on the hour axis and the live beam. It also draws the drag ghost (dashed outline over its wash), the selected-label underline, the focus ring, the caret, text selection, and the landing page's Start with today button.
- **Verdigris Wash** (`verdigris-wash`): a 14% tint (16% in dark) for a drop target under a drag, a selected row in Inbox and Lists, and the active palette option. Never hover.

### Neutral
- **Music Paper** (`music-paper` / `night-paper`): the page ground, also written into the browser theme colour and the manifest through `src/lib/theme-colors.ts`.
- **Rail Paper** (`rail-paper` / `night-rail`): one step darker, used for the nav rail and the public header's hover. At night it is the darkest tone (`#0e0d13`), so the rail reads as recessed.
- **Sheet** (`sheet` / `night-sheet`): one step lighter, for raised writing surfaces: the capture input, chips, the detail panel, the palette dialog, the current rail item, and the inner fill of a done glyph's head. At night it is the lightest ground (`#1f1e27`), so a raised thing is lighter, as it would be under a lamp.
- **Engraving Ink** (`engraving-ink` / `night-ink`): primary text, planned beams, the current nav item's fill and the ink button.
- **Ink Secondary** (`ink-secondary`): supporting text, quiet control labels.
- **Ink Quiet** (`ink-quiet`): metadata, hour numerals, placeholders, done items and their glyphs.
- **Hairline** (`hairline`): staff borders, section rules, outlined buttons and chips at rest.
- **Hairline Soft** (`hairline-soft`): the five staff lines, the faint hour gridlines inside a staff, and row separators.
- **Hover Tint** (`hover-tint`, token `--hover`, utility `bg-hover`): 6% ink (7% paper in dark) under every quiet control a pointer rests on: rail links, outline and text buttons, icon buttons, rows that open. A resting pointer never puts verdigris on screen.
- **Press Tint** (`press-tint`, `--press`, `active:bg-press`): 11% ink (12% paper in dark) while the same control is held down, so a press answers before the page does.
- **Field Stroke** (`field-stroke`): input borders and the hover border of chips and quiet public buttons. It is the only stroke strong enough to mark a control boundary on its own.

### Colour for Areas
A person may give each area one colour from a fixed palette of eight muted inks, or None. None is the default, for new areas and for every area that existed before colours, so nothing on screen changes until a colour is picked.
- **Palette** (`--area-<name>` in `globals.css`, names in `src/domain/area-color.ts`, stored as the name in `areas.color`): Clay `#964b2c` / `#d58464`, Ochre `#9d752f` / `#e8bc78`, Moss `#485320` / `#7a8753`, Sage `#6a816e` / `#acc5b0`, Slate `#597b99` / `#9bbfdf`, Plum `#5c3861` / `#946d9a`, Rose `#7a444f` / `#b67b85`, Stone `#796e63` / `#b2a59a` (day / night). Each holds 3:1 on Rail Paper, Paper and Sheet in both themes, stays apart from the others under protanopia, deuteranopia and tritanopia, and stays well away from Verdigris (`src/domain/area-color.test.ts`).
- **Where it shows:** only as a small dot (`AreaMark`, 8px, 6px in a month cell, `src/components/area-mark.tsx`) beside the area's name: the staff label and readout on the Score, a beam's label, the Week's chips and rows, Month marks, the detail panel's Area field, rows in Inbox, Due, Lists, Tags and Notes, and the rail's area links. A done item's dot is hollow, like its glyph. The colour never fills a beam, tints text or a row, or replaces a line form.
- **Never the only sign:** the dot is `aria-hidden` and always sits beside the area's name or inside a control named for the area, so nothing is lost to someone who cannot tell the colours apart.
- **Picker:** Settings, Areas, the swatch button on each row opens a native radio group (None first, then the palette in order). Arrow keys move and choose, the chosen swatch is ringed in Ink (the Ink-for-Selection Rule), focus keeps the global ring, and each swatch is 44px on touch.

### Named Rules
**The One Declaration Rule.** Every colour token is declared once on `:root` as `light-dark(day, night)`, and `color-scheme` picks the side: `light dark` by default (the device decides), forced by `data-theme="light"` or `"dark"` from the theme cookie. A token never has a second dark block to keep in sync. `src/lib/theme-colors.test.ts` reads the paper token from that one declaration.

**The Tonal Depth Rule.** Depth is three tones, not lines or shadows: Rail Paper below the page, Music Paper the page, Sheet above it. At night the steps are wider than by day (recessed rail `#0e0d13`, page `#14131a`, sheet `#1f1e27`), because a hairline carries less at night.

**The Now Rule.** Verdigris means now, a drag target, or the focused or selected thing. It never marks an item type, an area, a category or a success message. A screen with no now and nothing focused carries almost no verdigris.

**The Ink-for-Selection Rule.** The current navigation item is marked in ink (an ink tick on a raised sheet) and the active segment of a toggle is filled with ink, never verdigris. Place in the app is shown in ink; verdigris is kept for time and focus.

**The No-Type-Hue Rule.** PRODUCT.md allowed a small set of item-type hues. The shipped system uses none. Type is shown by glyph shape (see Components), so do not introduce type colours without revisiting that decision.

## Typography

**Display Font:** Besley (with Georgia, serif), loaded through `next/font/google` as `--font-besley`.
**Body Font:** Hanken Grotesk (with system-ui, -apple-system, Segoe UI, sans-serif) as `--font-hanken`.

**Character:** Besley gives headings the cut of a printed programme; Hanken Grotesk is neutral, compact and legible at 12 to 14px, where most of the app lives.

### Hierarchy
- **Display** (500, `clamp(2.6rem, 1.4rem + 5.2vw, 5.25rem)`, line-height 1, -0.025em, balanced, max 13ch): the landing page headline only.
- **Headline** (500, `clamp(28px, 3vw, 40px)`, 1.1, -0.015em): every app page title (Today's date, Week, Month, Inbox, Due, Lists, Notes, Tags, Search, Settings), always through the `headline` utility in `globals.css`, which also balances the lines. In a day's title the weekday is set in Ink Secondary, so the date leads ("Thursday 15 October"). Under every title sits one `page-summary` line (15px, 1.5, Ink Secondary). The note editor's title field is the one exception (3.2vw, 1.15), because it is a growing text field. Landing section heads use a larger clamp (`1.6rem` to `2.25rem`).
- **Title** (Besley 500, 18px to 22px): section heads inside a page (Waiting, Subtasks, Linked notes, Due's Earlier, This week and Later at 18px), staff names (16px, 19px at rail width) and the wordmark (600, 20px to 22px, -0.01em).
- **Body** (Hanken 400, 14px, 1.45): the default for the app. Page subtitles under an app headline and public body copy step up to 15px at 1.6 (Body Large), the landing lead paragraph to 17px to 18px, held to 34ch to 36rem. Note bodies are set for reading at 16px, 1.65, 68ch.
- **Mono** (system monospace, 0.88em on Rail Paper with a soft hairline): inline code in notes only.
- **Label** (Hanken 500, 13px, 20px line): beam labels, secondary actions and helper copy; the most used size in the codebase. Live beam labels go to 700, done labels to 400 in Ink Quiet.
- **Caption** (Hanken 500 to 600, 12px, tabular): hour numerals, the now flag, open counts, `kbd` keys.
- **Overline** (Hanken 600, 12px, 0.06em, uppercase, Ink Quiet): the rail's group headings (Plan, Capture, Library), its Open today, by area heading, and the same headings in the phone's More sheet. Nowhere else.

### Named Rules
**The Tabular Time Rule.** Every `<time>`, clock, count and date numeral uses tabular figures (`font-variant-numeric: tabular-nums`, set globally on `time` and `.tabular`). Times never jitter as they change.

**The Serif Reads, Sans Operates Rule.** Besley is for names and headings a person reads. Buttons, inputs, labels and metadata are always Hanken Grotesk.

## Layout

The app is a two-column shell: a nav rail and a content column. At 760px and up (the `rail` breakpoint) the rail is a sticky, full-height column on Rail Paper with a hairline right edge. Below 760px it becomes a slim header and a bottom bar (see Navigation), and the area readout is dropped.

The Score is the organizing grid. A sticky label column (`--lw`, 80px, or 104px at rail width) holds staff names. The hour axis is 76px per hour (`background-size: 76px`), each staff sub-row is 25px tall with five lines 6px apart, and beams snap to quarter hours. On the app, the axis covers 07:00 to 20:00, widened to whole hours that hold every beam and now. When its container has room for more, it gains whole hours to fill it, later ones up to 24:00 first so nothing already drawn moves, then earlier ones down to 00:00; the hour stays 76px, so what is left over is under one hour. A drag in progress keeps the axis it started on. When the axis is wider than its container, it scrolls horizontally inside it and opens scrolled to now (30% from the left) or to the first beam. On the landing sample score the visible window narrows instead (10:00 to 16:00 under 640px, 08:00 to 17:00, then 07:00 to 19:00 from 1000px), so it never scrolls sideways.

A page head with day or week steps (Day/Week, Previous and Next, the date) is a `page-head`: the steps sit to the right of the title when the page column, a `page` container, is at least 56rem wide, and in one row under the summary otherwise, so they never stack into a tower beside a wrapped title. Under the head, the tool row (capture field, any view switch, the Guide) carries one status line under the field. The screen's own news (a move, a tick, a plan) shares that line with the capture's, through `CaptureField`'s `screenStatus`, so a page reserves one line of room for news, not two.

Spacing follows Tailwind's 4px scale. Controls use 8px and 12px gaps, sections inside a page are separated by 28px (`mt-7`), and public sections by 96px to 128px. Settings is one column below 1180px. From 1180px it is two: a sticky index of its parts (Areas, Tags, Display, Your data) in an 11rem column on the left, and the sections on the right. Theme and Density sit together under Display; the rail's theme toggle changes the same setting. The public site is a single column capped at 1180px with 16px gutters (32px from 640px). Prose is held to 34ch to 72ch. Density is spacious by default. Settings has a Compact choice that tightens list rows only: the rows of Inbox, Due, Lists, a tag's page and the Score's List view, through `--row-y` (cookie `density`, `data-density` on `<html>`). The Score's staves and the Week are the same in both.

## Elevation & Depth

The system is flat. Structure is drawn with hairlines and three paper tones (Rail Paper, Music Paper, Sheet). Shadow appears only where something genuinely floats above the page.

### Shadow Vocabulary
- **Float** (`--float`, utility `shadow-float`: `0 24px 56px -16px` and `0 2px 6px`, warm ink by day, near black at night): the command palette, the Guide, the More sheet and the rail's account menu (which has no backdrop); the dialogs sit over a `rgb(8 7 10 / 0.48)` backdrop.
- **Lift** (`--lift`, utility `shadow-lift`: `0 6px 18px`, ink by day, black at night): the floating copy of a chip while it is dragged off the staves or across the Week.
- **Raised tab** (`0 1px 2px` plus an inset Hairline Soft ring): the current rail item only.
- **Selected chip ring** (`box-shadow: inset 0 0 0 1px var(--accent)`): doubles a selected chip's border in verdigris; a state mark, not depth.

### Named Rules
**The Engraved Line Rule.** If a boundary is needed, draw a hairline. A double barline (`3px double` Hairline) closes the end of the day and the landing's three-measure strip. Never use a shadow to separate two things that sit on the same page.

## Shapes

Corners are small and quiet. Controls and links use 6px (`rounded-md`), inputs, chips and outlined buttons 8px, dialogs 12px, and `kbd` keys and the now flag 4px. Checklist glyph heads are 2px squares, task heads are circles, and area load bars are full pills. Staves, rules and the score itself have square corners: the page is ruled paper, not a stack of cards. A notice that sits on a page, such as Today's left-over strip, is a ruled section (a Hairline above and below, no fill, no corners), not a tinted box.

## Components

### The Glyph (signature)
A 44 by 16px drawing of an item: a head and a beam, and the system's state language.
- **Planned:** Engraving Ink, filled head, beam as a 6px dashed bar (7px dash, 4px gap).
- **Live:** Verdigris, filled head, solid 9px beam.
- **Done:** Ink Quiet, hollow ring head on Paper, beam as a 1.5px outline with an empty interior.
- **Type by shape, never colour:** task has a round head, checklist a 2px-cornered square head, event no head and two 1.5px vertical ticks at its ends. Notes do not appear on the Score.
- **Completion:** on mark-done an ink fill sweeps left to right through the beam and fades (0.56s, `cubic-bezier(0.16, 1, 0.3, 1)`); removed under reduced motion.

### Beams and the Score
- **Beam:** a glyph stretched to its duration on a staff, label above in 13px Label with its start time in 12px Ink Quiet. The label sits over the playhead and the staff lines with a Music Paper halo (three soft `text-shadow`s), so the now line passes behind the words. A staff label says how many items are open only when there are some. Focus ring sits 6px off the beam. Selected shows a 2px verdigris underline on the label. The right 12px (24px on coarse pointers) is a resize grip.
- **Playhead:** a 2px verdigris rule through every staff at now, with a verdigris clock flag in the axis.
- **Drag ghost:** a 9px dashed verdigris outline over Verdigris Wash, with the target time range in 12px verdigris 600 above it. The staff under the pointer takes Verdigris Wash; the tray takes a 2px dashed verdigris outline.
- **Motion:** beams glide to new positions in 0.28s on the house curve and stop easing while tracking a pointer.
- **First day:** an account that has never stored an item (deleted ones count as stored) sees one example beam on each of its first three areas: a 9px dashed Hairline outline with no fill and no glyph head, its label in 13px Ink Quiet at 400. Examples are `aria-hidden`, take no pointer and no focus, and the Score opens scrolled to them rather than to now. An area named Work gets "Write the plan" at 10:00, Home "Groceries" at 18:00, Health "Walk" at 12:30; other areas take what is left in position order. One Ink Quiet line under the Score says they are examples. Until the first item exists the Any time row, the `0 open` counts, the key help, the line-form key, the touch hint and the Waiting tray are left out. Above the capture field a 15px Ink Secondary lead says what to type, and the placeholder turns through three real capture lines every 3.5s (static on the first under reduced motion). The first capture's status line says what was understood in a sentence and links to the day it landed on, or to the Inbox.

### Buttons
- **Shape:** gently rounded (6px); outlined variants 6px to 8px.
- **Public primary:** Verdigris fill, On Verdigris text, 15px 600, 12px by 20px. Hover mixes 14% ink into the verdigris over 150ms. Used only for Start with today, the landing's way in (in the hero and again at the close). The header's Sign in is a plain text link for returning users.
- **Public quiet:** hairline border, ink text, same size; hover strengthens the border to Field Stroke.
- **Ink:** Engraving Ink fill, Paper text, 500. The in-app primary action (New note, Search, Delete account once confirmed). Hover drops opacity to 0.9.
- **Outline:** hairline border, 6px by 12px, hover Hover Tint, pressed Press Tint. Secondary in-app actions.
- **Text and icon:** borderless, Ink Secondary, 32px square for icons; hover takes Hover Tint and Ink, pressed Press Tint.
- **Segments:** the checked part of a segmented choice (Score/List, Day/Week, Theme, Density, Changes apply to one or all) is filled with Ink and Paper text.
- **Easing between states:** links, buttons and fields ease colour, background, border and opacity over 140ms on the house curve (a base rule in `globals.css`). Movement keeps its own timing.
- **Touch:** under a coarse pointer every control is at least 44px tall: nav links, the day and week steps and date field, every text field (a base rule), chips, Plan for, the leftover and Settings buttons. A text button inside a row (an item title) keeps its size and gains a 44px hit area through the `tap-y` utility.
- **Focus:** a global 2px verdigris outline with 3px offset on every `:focus-visible`.

### Chips
- **Style:** Sheet fill, hairline border, 8px radius, 8px by 12px, 500 weight, glyph at 28px wide, then title, repeat mark, subtask count and up to two tags.
- **State:** hover strengthens the border to Field Stroke; selected turns the border verdigris and doubles it with an inset ring; done drops to Ink Quiet at 400; lifted fades to 35%.

### Inputs / Fields
- **Style:** Sheet fill, Field Stroke border, 8px radius, 10px by 14px. The capture field carries an inline `C` key hint and a status line beneath for "Saving" or an error.
- **Focus:** the global verdigris ring; the caret is verdigris.

### Navigation
- **Places:** every page a person goes to is one row of the `PLACES` table in `src/components/shell/places.ts`: its label, route, a hint of a few plain words ("Waiting for a day"), its rail group, whether it is a phone tab, its G-then-letter key and the palette's extra words. The rail, the phone bar, the More sheet, the palette and the G keys all read it, so they never disagree. The groups answer "what is this for": **Plan** (Today, Week, Month, Due: when things happen), **Capture** (Inbox: what has no day yet), **Library** (Lists, Notes, Tags: what is kept). Search and Settings belong to no group; the search field and the account menu reach them.
- **Rail, top to bottom:** Rail Paper. The wordmark in Besley 600 with the crossing-axes mark. One search field: a 36px button shaped like a field (Sheet fill, Hairline border, 8px radius, hover Field Stroke), a 16px search glyph, "Search or go to…" in 13px Ink Quiet and the key hint (`Ctrl K`, `⌘K` on a Mac) as a small `kbd`; it opens the palette, which searches, goes to any page or date, and captures. Then the three groups, each an Overline heading over its links: Hanken 500 Ink Secondary with 18px icons, the hint as the link's tooltip. The current page is a raised Sheet tab: Ink text at 600, an inset Hairline Soft edge, a 1px shadow, and a 3px Ink tick at its leading edge that marks the state on its own. Hover is Hover Tint. Then, under a Hairline Soft rule, **Open today, by area**: a readout, not links, in 13px Ink Quiet with each open count as a 6px pill bar in Ink Quiet at 55% opacity (8px plus 7px per open item, capped at 72px) and the number spoken to screen readers. Last, pinned to the foot, one **Account** row.
- **Account menu:** the Account row (settings glyph, the word, a small up chevron) opens a native `popover` just above it, 184px wide on Sheet with a Hairline border, 8px radius and the Float shadow: Settings, Theme, Sign out (a real POST form), then Privacy and Terms in 12px Ink Quiet under a Hairline Soft rule. It lifts 4px and fades in over 160ms (none under reduced motion). Opening it moves focus to Settings; Tab walks its items in order; Escape or a click outside closes it and focus returns to the row, which carries `aria-expanded`. On a Settings page the Account row takes the raised tab and tick, as More does on a phone. Every row is 44px under a coarse pointer.
- **Phone (below 760px):** three pieces instead of the rail. A 56px header on Music Paper with a Hairline Soft rule under it: the wordmark, and the palette as a 44px search-glyph button ("Search or go to"). A bar fixed to the bottom on Rail Paper with a Hairline top edge, 64px tall plus the safe area: Today, Week, Due and Inbox (the table's order), each a 20px icon over an 11px label in Ink Quiet, then More. The current tab is Ink at 600 with a 24 by 3px Ink tick on its top edge (the rail's tick turned on its side); More takes the tick when the page is one of its own. More opens a native `<dialog>` sheet that rises from the bottom (320ms on the house curve, none under reduced motion) on Sheet with 14px top corners, a grabber, the Float shadow and the palette's backdrop. It holds Search, then each group that has places off the bar (Plan: Month; Library: Lists, Notes, Tags), then Account (Theme, Settings, Sign out), each section under a Hairline Soft rule and an Overline heading, each place a 48px row in 15px with its hint as a 13px Ink Quiet second line, and Privacy and Terms last. Escape, a tap on the backdrop or a link closes it, and focus returns to More. The page ends 64px above the bar.
- **Palette:** its Go to entries are the same places plus the Guide, each with its hint in 13px Ink Quiet at the right.
- **Day and week steps:** Day/Week, then Previous and Next joined as one outlined pair (they never wrap apart), the date field, and Today or This week when away from it. All 36px tall, 44px under a coarse pointer. The Month has the same pair and This month, and no date field; its neighbours are fetched only once a pointer rests on Previous or Next or focus reaches them.

### Loading
A loading page is drawn in the shape of the page it becomes, in Press Tint strokes and real hairlines, breathing slowly (`animate-breathe`, 2.4s, opacity to 45%; still under reduced motion). A day draws its title, the capture field's outline, the hour axis at 76px and three 85px staves with a 104px label column; a week draws seven ruled day columns; a month draws its weekday heads and five ruled weeks of day cells, 8rem tall when wide and 56px when compact; Inbox and Lists draw the capture outline above their ruled rows; the other list pages draw ruled rows only. Each is one `role="status"` that says Loading.

### The Month
A calendar of one month, `/month` for this one and `/month/<YYYY-MM>` for any other, drawn in `src/features/month/`. The server works out every day; the page only draws.
- **Grid:** whole weeks from the week's first day (Monday, `WEEK_STARTS_ON`) on or before the 1st, five of them, six when the month needs a sixth. Square ruled cells (Hairline) under a row of weekday heads in 12px Ink Secondary (`Mon`, or `Mo` when compact). Days of the months either side keep their marks and set their number in Ink Quiet. The 1st names its month beside its number ("1 Oct"), so a row that crosses months reads at a glance.
- **Today:** its number on an Ink disc with Paper text, the place-in-time version of the Ink-for-Selection Rule. Verdigris stays for a live item's glyph, the drop target under a drag (Verdigris Wash), a selected item (wash and ring) and focus.
- **Marks:** at most three a day, sent from the server with a count of the rest. Day-only items first in area order, then timed ones by start, then due dates. Each is one 22px line: the glyph at 72% (its head and line form carry type and state), the start time in Ink Quiet, then the title, truncated by CSS. A later day of an item that runs past midnight says "to 01:00" and is not draggable. A due date reads "Due", or "· due" after a planned time on the same day. The area is in the mark's name and tooltip, and on the phone's day list. "+2 more" links to the day.
- **Compact (the month column under 36rem: phones, and a tablet beside the rail):** cells are 56px tall and show the number over up to three 6px dots (Ink filled while planned, a hollow ring once done, Verdigris while live) and "+N". The chosen day is tinted with Hover Tint and listed under the grid in 44px rows (glyph, time, title, area), with a link to open it. A first tap chooses a day, a second opens it.
- **Keys and pointer:** the grid is an ARIA grid with one focusable day (roving tabindex), named like "Wednesday 14 October, 3 items". Arrows move a day or a week, Home and End go to the week's ends, Page Up and Page Down keep the day of the month in the next or last month, Enter or a click opens the day (Today when it is today). Tab reaches the focused day's items. Marks drag to another day with the Week's gesture and its move action; a click or Enter on one opens the detail panel through `?item=`.
- **Capture:** the tool row's field is labelled with the day in focus, and a line that names no day lands on it.

### Note Toolbar
A sticky bar over the note body, held to the body's 68ch measure, with a Hairline Soft rule beneath. Its 32px icon tools (44px on touch) sit in three named groups: Type (Heading, Subheading, Quote, Code), Style (Bold, Italic, Link) and Lists (Bulleted, Numbered), each name in 12px Ink Quiet from 640px and spoken only below. It stays on screen while the note is open, so the tools are found without focusing the body first. A pressed tool is filled with Ink.

### Motion
Movement is spent on three moments, each on the house curve and each dropped under `prefers-reduced-motion`:
- **A change of page** (a new path, not a new query): React's `<ViewTransition>` in `src/components/shell/page-transition.tsx`. The old page fades in 120ms; the new one waits 80ms, then fades in over 220ms while rising 6px over 360ms. The rail does not move. A change of query (the selected item, Score or List) is the same page and keeps the Score and List morph.
- **The detail panel arriving:** 16px in from the right beside the page, 8px up when it stacks under it, 320ms. Movement only, no fade, so its text is never measured half-transparent.
- **A sheet rising:** the phone's More sheet, 320ms from below; the palette and Guide keep their 200ms rise.
The done sweep on a glyph and the beam glide stay as they were. Hover and press only ease colour (140ms).

### Command Palette
A native `<dialog>` in Sheet, 560px wide, 12px radius, Dialog lift shadow, rising 8px with a 0.985 scale-in over 200ms. Options are 40px tall; the active option takes Verdigris Wash.

### Guide
All help lives in one place. The Guide is the palette's dialog (same Sheet, width, radius, lift and rise), titled Guide in Besley 20px. It opens on the screen's own topics, each a section under a Hairline Soft rule with a 17px Besley head (Capture words, Moving beams, Moving between days), then every keyboard shortcut. Capture words are a two-column definition list from 480px: the term in 13px Ink 500, the words in 13px Ink Secondary, with one specimen line set in a Hairline box on Paper.
- **Way in:** one Guide button per screen that has topics (Today and any day, Week, Month, Inbox), always the last control of the tool row under the page header (capture field, then any view switch), pushed to the row's right edge. Outline, 8px radius, a 16px circled question mark and the word Guide; 38px tall like the Score/List switch, 44px under a coarse pointer. `?` opens the same dialog on any screen, and the palette lists it as Guide. Screens without topics show no button; there `?` opens the shortcuts alone.
- **Never beside content:** nothing floats over the Score, a panel or a drag handle. The Score's and Week's keyboard paragraph stays in the page only as an `sr-only` description of every beam and chip.
- **Dismissal:** Escape, Close, or a click on the backdrop; focus returns to the button.

## Do's and Don'ts

### Do:
- **Do** show an item's state with its line form: dashed planned, solid live, hollow done.
- **Do** reserve Verdigris (`#0a675a`, dark `#45c7b0`) for now, a drag target, focus or selection, and the public Start with today.
- **Do** mark the current navigation item in Engraving Ink (its tick), not verdigris.
- **Do** draw structure with Hairline (28% ink) and Hairline Soft (12% ink), and close the end of a sequence with a `3px double` rule.
- **Do** set every time, count and date numeral in tabular figures.
- **Do** use the house curve `cubic-bezier(0.16, 1, 0.3, 1)` for movement, and drop the movement under `prefers-reduced-motion`.
- **Do** keep copy quiet and plain: sentence case, no exclamation marks, no guilt about overdue items ("Waiting", "For things that belong to the day but not to an hour.").

### Don't:
- **Don't** colour-code item types; type is the glyph's head shape. An area's colour is the person's choice from the area palette, shown only as a dot beside its name.
- **Don't** add Verdigris, or any hue near it, to the area palette.
- **Don't** use verdigris for success, decoration, icons or headings.
- **Don't** add shadows to cards or rows; only floating layers (the palette, a dragged chip) are lifted.
- **Don't** set controls, labels or metadata in Besley.
- **Don't** add gradients beyond the ruled-line patterns that draw staves and dashes.
- **Don't** use exclamation marks, streaks, overdue reds or productivity-guru copy.
