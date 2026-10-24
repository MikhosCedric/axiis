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
    fontSize: "clamp(2.6rem, 1.4rem + 5.2vw, 5.5rem)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.03em"
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
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.engraving-ink}"
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

### Colour for Areas and Tags
A person may give each area, and each tag, one colour from a fixed palette of twelve muted inks, or None. None is the default, for new areas and tags and for every one that existed before colours, so nothing on screen changes until a colour is picked.
- **Palette** (`--area-<name>` in `globals.css`, names in `src/domain/area-color.ts` in picker order, stored as the name in `areas.color` and `tags.color`), day / night: Clay `#964b2c` / `#d58464`, Terracotta `#9d653f` / `#db9f77`, Ochre `#9d752f` / `#e8bc78`, Mustard `#886a01` / `#c4a450`, Moss `#485320` / `#7a8753`, Sage `#6a816e` / `#acc5b0`, Slate `#597b99` / `#9bbfdf`, Indigo `#43589e` / `#7891dc`, Plum `#5c3861` / `#946d9a`, Mauve `#79576d` / `#b38ea6`, Rose `#7a444f` / `#b67b85`, Stone `#796e63` / `#b2a59a`. Warm to cool, then the neutral. Terracotta, Mustard, Indigo and Mauve joined the first eight in migration 0011; each new one was found by a search over OKLCH with the other colours fixed, its night side 0.19 lighter at the same chroma and hue.
- **What every colour is checked for** (`src/domain/area-color.test.ts`, computed, both themes): 3:1 on Rail Paper, Paper and Sheet (WCAG 1.4.11 for a mark; the dot is never text, so the 4.5:1 text ratio does not apply); at least 0.025 apart in OKLab from every other colour as seen, and as seen under protanopia, deuteranopia and tritanopia (Machado 2009); at least 0.08 from Verdigris; at least 0.095 from a reference alarm red and success green, so no colour reads as a status. The checks also hold the token list, the palette and both database checks to the same names in the same order.
- **Left out of the palette:** a teal and an olive. The only teal that stays apart from Sage and Slate sits 0.081 from Verdigris by day, too close to the colour of now; olive sat 0.081 from Verdigris by day and 0.032 from Moss.
- **Where it shows:** only as a small dot (`AreaMark`, 8px, 6px in a month cell and beside a tag, `src/components/area-mark.tsx`) beside the name: for an area, the staff label and readout on the Score, a beam's label, the Week's chips and rows, Month marks, the detail panel's Area field, rows in Inbox, Due, Lists, Tags and Notes, the rail's area links and the filter chip; for a tag, its `#name` in a row's tag line, the detail panel's tag chips, the Tags index, the tag's own page and the filter chip. A done item's area dot is hollow, like its glyph. The colour never fills a beam, tints text or a row, or replaces a line form.
- **Never the only sign:** the dot is `aria-hidden` and always sits beside the name or inside a control named for it, so nothing is lost to someone who cannot tell the colours apart.
- **Picker:** Settings, Areas and Settings, Tags: the swatch button on each row opens a native radio group (None first, then the palette in order; `src/components/color-picker.tsx`). Arrow keys move and choose, the chosen swatch is ringed in Ink (the Ink-for-Selection Rule), focus keeps the global ring, and each swatch is 44px on touch. While two or more areas have no colour, Settings, Areas carries one quiet line on Sheet suggesting a colour, with Not now (cookie `colour-hint`).
- **No colour per item.** An item takes its area's colour and wears its tags' colours; it has no accent of its own. A per-item hue would be a third colour system beside areas and tags, would compete with the line forms for what state means, and would let colour stand for urgency (the "red task") that the voice rules out. The No-Type-Hue Rule stands for the same reason.

### Filters (colour as navigation)
An area or a tag narrows a page to what belongs to it. The filter lives in the address (`?area=<id>`, `?tag=<name>`, `src/features/filter/`), so Back, a reload and a shared link keep it.
- **Ways in:** each area in the rail's Open today, by area, and in a phone's More sheet, is a link: choosing one narrows the page you are on (Today from a page that cannot be narrowed); the area shown takes the raised Sheet tab and Ink tick, and choosing it again shows every area. A then 1 to 9 picks an area in the rail's order, A then 0 shows all; the palette offers Show only <area> and Show all areas. A tag filter is reached by its address (`?tag=errands`) on Today and any day, the Week and the Inbox; elsewhere a tag's own page is its filter.
- **Which pages:** an area filter narrows Today and any day (only that area's staff is drawn), the Week, the Month (before a day's marks are capped, so "+2 more" counts only the area's), the Inbox, Due, Lists and the notes list. A tag filter narrows the pages that already read tags: days, the Week and the Inbox. Left over on Today narrows to the area and offers no Move all, since that would move what the filter hides; under a tag filter it is not shown.
- **Saying so:** under the title, "Showing only" and a chip per part (Sheet, Hairline, a full radius, the colour's dot, the name, and a 24px cross in Ink Quiet, 44px under a coarse pointer, named "Stop showing only Work"). Counts say what they count: the glance line reads "1 of 2 done in Work" and "5 open in Work", and the Inbox, Due and Lists summaries start "In Work:".
- **Kept while moving:** Previous, Next, the date and month pickers, Day/Week, This week and This month, a Month day, a Week day's heading and the rail's place links keep the filter on the pages that can show it. An area id that is not one of the user's, or a tag name that cannot be one, is ignored, and the page is whole.

### Named Rules
**The One Declaration Rule.** Every colour token is declared once on `:root` as `light-dark(day, night)`, and `color-scheme` picks the side: `light dark` by default (the device decides), forced by `data-theme="light"` or `"dark"` from the theme cookie. A token never has a second dark block to keep in sync. `src/lib/theme-colors.test.ts` reads the paper token from that one declaration.

**The Tonal Depth Rule.** Depth is three tones, not lines or shadows: Rail Paper below the page, Music Paper the page, Sheet above it. At night the steps are wider than by day (recessed rail `#0e0d13`, page `#14131a`, sheet `#1f1e27`), because a hairline carries less at night.

**The Now Rule.** Verdigris means now, a drag target, or the focused or selected thing. It never marks an item type, an area, a category or a success message. A screen with no now and nothing focused carries almost no verdigris.

**The Ink-for-Selection Rule.** The current navigation item is marked in ink (an ink tick on a raised sheet) and the active segment of a toggle is filled with ink, never verdigris. Place in the app is shown in ink; verdigris is kept for time and focus.

**The No-Type-Hue Rule.** PRODUCT.md allowed a small set of item-type hues. The shipped system uses none. Type is shown by glyph shape (see Components), so do not introduce type colours without revisiting that decision. The same holds for a colour per item: an item shows its area's and its tags' colours and has none of its own (Colour for Areas and Tags).

## Typography

**Display Font:** Besley (with Georgia, serif), loaded through `next/font/google` as `--font-besley`.
**Body Font:** Hanken Grotesk (with system-ui, -apple-system, Segoe UI, sans-serif) as `--font-hanken`.

**Character:** Besley gives headings the cut of a printed programme; Hanken Grotesk is neutral, compact and legible at 12 to 14px, where most of the app lives.

### Hierarchy
- **Display** (500, `clamp(2.6rem, 1.4rem + 5.2vw, 5.5rem)`, line-height 1, -0.03em, balanced, max 13ch on a phone): the landing page headline only. From 900px it is two lines, "Your tasks and your time," then "on one page.", and its size is also held to `(100vw - 4rem) / 12.6` so the first line (12.3em in Besley) never wraps. "on one page." sits on a staff of five Hairlines drawn behind the words, so its descenders hang through the lines like notes.
- **Headline** (500, `clamp(28px, 3vw, 40px)`, 1.1, -0.015em): every app page title (Today's date, Week, Month, Inbox, Due, Lists, Notes, Tags, Search, Settings), always through the `headline` utility in `globals.css`, which also balances the lines. In a day's title the weekday is set in Ink Secondary, so the date leads ("Thursday 15 October"). Under every title sits one `page-summary` line (15px, 1.5, Ink Secondary). The note editor's title field is the one exception (3.2vw, 1.15), because it is a growing text field. Landing section heads use a larger clamp (`1.6rem` to `2.25rem`).
- **Title** (Besley 500, 18px to 22px): section heads inside a page (the Inbox tray, Next up, Subtasks, Linked notes, Due's Past due, This week and Later at 18px), staff names (16px, 19px at rail width) and the wordmark (600, 20px to 22px, -0.01em).
- **Body** (Hanken 400, 14px, 1.45): the default for the app. Page subtitles under an app headline and public body copy step up to 15px at 1.6 (Body Large), the landing lead paragraph to 17px to 18px, held to 34ch to 36rem. Note bodies are set for reading at 16px, 1.65, 68ch.
- **Mono** (system monospace, 0.88em on Rail Paper with a soft hairline): inline code in notes only.
- **Label** (Hanken 500, 13px, 20px line): beam labels, secondary actions and helper copy; the most used size in the codebase. Live beam labels go to 700, done labels to 400 in Ink Quiet.
- **Caption** (Hanken 500 to 600, 12px, tabular): hour numerals, the now flag, open counts, `kbd` keys.
- **Overline** (Hanken 600, 12px, 0.06em, uppercase, Ink Quiet): the rail's group headings (Plan, Capture, Library), its Open today, by area heading, and the same headings in the phone's More sheet. Nowhere else.

### Named Rules
**The Tabular Time Rule.** Every `<time>`, clock, count and date numeral uses tabular figures (`font-variant-numeric: tabular-nums`, set globally on `time` and `.tabular`). Times never jitter as they change.

**The One Clock Rule.** Every time of day on screen is written by `src/lib/clock.ts` on the reader's Time format: the Score's axis and now flag, beams, the List, Week and Month marks, the detail panel's When and Time rows, Due, Lists, tag pages, notes' edited line, and capture's preview and status lines. 24-hour reads `09:30`, its axis hours `09`. 12-hour reads `9:30 AM`, its axis hours `9 AM` (midnight `12 AM`, noon `12 PM`), always with a no-break space before AM or PM, so a label never breaks and a 76px hour holds its label. The strings are built by hand, not by `Intl`, whose 12-hour spacing differs between ICU versions on the server and in browsers. Anything typed reads either clock: `9am`, `9:30 pm`, `9.30 p.m.`, `21:30`, `2130`.

**The Serif Reads, Sans Operates Rule.** Besley is for names and headings a person reads. Buttons, inputs, labels and metadata are always Hanken Grotesk.

## Layout

The app is a two-column shell: a nav rail and a content column. At 760px and up (the `rail` breakpoint) the rail is a sticky, full-height column on Rail Paper with a hairline right edge. Below 760px it becomes a slim header and a bottom bar (see Navigation), and the area readout is dropped.

The Score is the organizing grid. A sticky label column (`--lw`, 80px, or 104px at rail width) holds staff names. The hour axis is 76px per hour (`background-size: 76px`), each staff sub-row is 25px tall with five lines 6px apart, and beams snap to quarter hours. On the app, the axis covers 07:00 to 20:00, widened to whole hours that hold every beam and now. When its container has room for more, it gains whole hours to fill it, later ones up to 24:00 first so nothing already drawn moves, then earlier ones down to 00:00; the hour stays 76px, so what is left over is under one hour. A drag in progress keeps the axis it started on. When the axis is wider than its container, it scrolls horizontally inside it and opens scrolled to now (30% from the left) or to the first beam, rounded back to a whole hour so the first label is never clipped. On the landing's sample score the hours are counted from the hour the visitor is in (`src/features/landing/live-day.ts`), and the window narrows instead of scrolling: two hours before now to four after under 640px, three to six, then five to seven from 1000px.

A page head with day or week steps (Day/Week, Previous and Next, the date) is a `page-head`: the steps sit to the right of the title when the page column, a `page` container, is at least 56rem wide, and in one row under the summary otherwise, so they never stack into a tower beside a wrapped title. Under the head, the tool row (capture field, any view switch, the Guide) carries one status line under the field. The screen's own news (a move, a tick, a plan) shares that line with the capture's, through `CaptureField`'s `screenStatus`, so a page reserves one line of room for news, not two.

Spacing follows Tailwind's 4px scale. Controls use 8px and 12px gaps, sections inside a page are separated by 28px (`mt-7`), and public sections by 96px to 128px. Settings is one column below 1180px. From 1180px it is two: a sticky index of its parts (Areas, Tags, Display, Your data) in an 11rem column on the left, and the sections on the right. Theme, Density and Time format sit together under Display; the rail's theme toggle changes the same setting. The public site is a single column capped at 1180px with 16px gutters (32px from 640px). Prose is held to 34ch to 72ch. Density is spacious by default. Settings has a Compact choice that tightens list rows only: the rows of Inbox, Due, Lists, a tag's page and the Score's List view, through `--row-y` (cookie `density`, `data-density` on `<html>`). The Score's staves and the Week are the same in both. Time format is Auto, 12-hour or 24-hour (cookie `clock`). Auto follows the browser's language and region: the time-zone sync writes that clock into the cookie (`auto-12` or `auto-24`) and refreshes once, so the server and the browser always draw the same times. A first visit with no cookie is drawn on the 24-hour clock until that refresh.

## Elevation & Depth

The system is flat. Structure is drawn with hairlines and three paper tones (Rail Paper, Music Paper, Sheet). Shadow appears only where something genuinely floats above the page.

### Shadow Vocabulary
- **Float** (`--float`, utility `shadow-float`: `0 24px 56px -16px` and `0 2px 6px`, warm ink by day, near black at night): the command palette, the Guide, the More sheet and the rail's account menu (which has no backdrop); the dialogs sit over a `rgb(8 7 10 / 0.48)` backdrop.
- **Lift** (`--lift`, utility `shadow-lift`: `0 6px 18px`, ink by day, black at night): the floating copy of a chip while it is dragged off the staves or across the Week.
- **Raised tab** (`0 1px 2px` plus an inset Hairline Soft ring): the current rail item only.
- **Selected chip ring** (`box-shadow: inset 0 0 0 1px var(--accent)`): doubles a selected chip's border in verdigris; a state mark, not depth.

### Named Rules
**The Engraved Line Rule.** If a boundary is needed, draw a hairline. A double barline (`3px double` Hairline) closes the end of the day and the landing's story. The public footer opens on a final barline: a Hairline over a 3px Ink rule, the way a score ends. Never use a shadow to separate two things that sit on the same page.

## Shapes

Corners are small and quiet. Controls and links use 6px (`rounded-md`), inputs, chips and outlined buttons 8px, dialogs 12px, and `kbd` keys and the now flag 4px. Checklist glyph heads are 2px squares, task heads are circles, and area load bars are full pills. Staves, rules and the score itself have square corners: the page is ruled paper, not a stack of cards. A notice that sits on a page, such as Today's left-over strip, is a ruled section (a Hairline above and below, no fill, no corners), not a tinted box.

## Components

### The Glyph (signature)
A 44 by 16px drawing of an item: a head and a beam, and the system's state language.
- **Planned:** Engraving Ink, filled head, beam as a 6px dashed bar (7px dash, 4px gap).
- **Live:** Verdigris, filled head, solid 9px beam.
- **Done:** Ink Quiet, hollow ring head on Paper, beam as a 1.5px outline with an empty interior.
- **Type by shape, never colour:** task has a round head, checklist a 2px-cornered square head, event no head and two 1.5px vertical ticks at its ends. Notes do not appear on the Score. The printed key under the Score and the Week shows the shapes beside the line forms (Task, Event, Checklist), and the Guide's "What you see" explains both, so the shapes are learned from the page.
- **Fixed or flexible:** an event's label gives its whole time ("16:00–17:00") on a beam and a Week row; a task gives its start. An open timed item whose end has passed adds "passed" in the clock's Ink Quiet, and its name says "passed" in the same place.
- **An item's name starts with what it draws** (WCAG 2.5.3, Label in Name). A beam, chip, Week row or Month mark is a button named by `src/features/today/item-name.ts`: first the words on it in the order drawn (title, count "2/5", time on the reader's clock, "passed", the due words, the area, the `#tags`), then what the drawing says without words ("ends 11:30", the area under a staff, the state, "repeats", "2 of 5 subtasks done", "tagged ..."). So a voice-control user who says what they see reaches the item. The pieces on screen are separated by real spaces, not only margins, so the text reads as words. A Month day cell is named by its content (an `sr-only` "Friday 9 October, 1 item" before its marks), since a name must hold the marks drawn inside it.
- **Completion:** on mark-done an ink fill sweeps left to right through the beam and fades (0.56s, `cubic-bezier(0.16, 1, 0.3, 1)`); removed under reduced motion.

### Beams and the Score
- **Beam:** a glyph stretched to its duration on a staff, label above in 13px Label with its start time in 12px Ink Quiet. The label sits over the playhead and the staff lines with a Music Paper halo (three soft `text-shadow`s), so the now line passes behind the words. A staff label says how many items are open only when there are some. Focus ring sits 6px off the beam. Selected shows a 2px verdigris underline on the label. The right 12px (24px on coarse pointers) is a resize grip.
- **Playhead:** a 2px verdigris rule through every staff at now, with a verdigris clock flag in the axis.
- **Drag ghost:** a 9px dashed verdigris outline over Verdigris Wash, with the target time range in 12px verdigris 600 above it. The staff under the pointer takes Verdigris Wash; the tray takes a 2px dashed verdigris outline.
- **Motion:** beams glide to new positions in 0.28s on the house curve and stop easing while tracking a pointer.
- **First day:** an account that has never stored an item (deleted ones count as stored) sees one example beam on each of its first three areas: a 9px dashed Hairline outline with no fill and no glyph head, its label in 13px Ink Quiet at 400. Examples are `aria-hidden`, take no pointer and no focus, and the Score opens scrolled to them rather than to now. An area named Work gets "Write the plan" at 10:00, Home "Groceries" at 18:00, Health "Walk" at 12:30; other areas take what is left in position order. One Ink Quiet line under the Score says they are examples. Until the first item exists the Any time row, the `0 open` counts, the key help, the line-form key, the touch hint and the Inbox tray are left out. Above the capture field a 15px Ink Secondary lead says what to type, and the placeholder turns through three real capture lines every 3.5s (static on the first under reduced motion). The first capture's status line says what was understood in a sentence and links to the day it landed on, or to the Inbox.

### Orientation (where you are, what is next)
Added after the owner said a busy day felt lost and overwhelming (`docs/ux-clarity.md`).
- **At a glance:** under every day's, week's and month's title, one `page-summary` line, built by `src/features/day/glance.ts`: where it sits from today, then how it stands, joined by middle dots ("Today · 3 of 10 done · now: Focus block · next: Design sync at 16:00 · 1 due"; "This week · 3 days left · 15 open · 2 due · 4 in the Inbox"; "Nothing left today"). It doubles as the page's place in time, so no eyebrow sits over the title. A day with items adds a 160px ruled progress line under it (`ProgressLine`, `src/components/progress-line.tsx`): dashed for what is still to do, solid Ink Secondary for what is done, as on Lists. Never a ring or a donut.
- **Next up:** at the top of Today, under the tool row, a Title-size Besley head over at most three rows: the done tick (the glyph as a checkbox), the title (700 while happening), and one Ink Quiet line: "Now, until 15:00" in Verdigris 600 for what is happening, "16:00 to 17:00" for an event, "At 18:00" for a task, "Any time", then the due mark and the area. Held to 760px.
- **Focus:** an outlined toggle after Score/List, Ink-filled while on (the segment rule). On, Today shows Next up with everything happening, the next three by time and everything due, and puts the rest (the Score or List, the Inbox tray, left over) inside one `details` between Hairlines whose summary counts it ("The whole day · 6 more planned · 4 in the Inbox · 2 left over · 3 done"). Kept per device in the `focus` cookie, read on the server, so the first paint is right.
- **Done folds:** done chips in Any time and the Inbox tray, and done List rows, fold into one quiet "Done (n)" disclosure (13px Ink Quiet 500, a 10px chevron that turns, no turn under reduced motion). A chip just ticked stays where it was for four seconds, or while it is open in the panel, then folds.
- **Left over** sits below the day, not above it: today's plan first.
- **Past days** on the Week set their weekday and number in Ink Quiet; today's number sits on an Ink disc, as on the Month.
- **Tour:** a new account's Today opens with four steps in a ruled section (Hairline above and below, no fill) under the tool row: a 17px Besley title, one or two sentences in Ink Secondary held to 62ch, then Back (outline), Next or Done (Ink), "Tour, 2 of 4" in 12px Ink Quiet, and Skip the tour at the row's end. Never a modal or a pointer bubble over the page. Finishing or skipping writes `tour=done`; the Guide's "Take the tour again" writes `tour=replay` and goes to Today.

### The due mark
`DueMark` (`src/features/today/due-mark.tsx`): a 9 by 11px flag drawn in line (a pole and a pennant) and words from `dueWords`: "Past due", "Due today", "Due tomorrow", "Due Tue" within the week, "Due 3 Nov" after. Once the date has come the pennant is filled and the words go to 600 in Ink Secondary; before it, outlined and in the row's metadata ink. Shown on Score beams and chips, List rows, Week rows and Next up. Never red, never a count of days late; it is the same sign everywhere, so it is learned once.

### Buttons
- **Shape:** gently rounded (6px); outlined variants 6px to 8px.
- **Public primary:** Verdigris fill, On Verdigris text, 15px 600, 12px by 20px, 48px tall. It carries a 26px beam after its words, dashed at rest and solid under the pointer or focus, as a planned item turns live (`ActionBeam`, `src/components/public/site-chrome.tsx`). Hover mixes 14% ink into the verdigris over 150ms; a press sinks it 1px. No glow, no magnetic pull. Used only for Start with today, the landing's way in (in the hero and again at the close). The header's Sign in is a plain text link for returning users.
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
- **Places:** every page a person goes to is one row of the `PLACES` table in `src/components/shell/places.ts`: its label, route, a hint of a few plain words ("Captured, with no day yet"; Inbox, Due and Lists also put theirs under their title), its rail group, whether it is a phone tab, its G-then-letter key and the palette's extra words. The rail, the phone bar, the More sheet, the palette and the G keys all read it, so they never disagree. The groups answer "what is this for": **Plan** (Today, Week, Month, Due: when things happen), **Capture** (Inbox: what has no day yet), **Library** (Lists, Notes, Tags: what is kept). Search and Settings belong to no group; the search field and the account menu reach them.
- **Rail, top to bottom:** Rail Paper. The wordmark in Besley 600 with the crossing-axes mark. One search field: a 36px button shaped like a field (Sheet fill, Hairline border, 8px radius, hover Field Stroke), a 16px search glyph, "Search or go to…" in 13px Ink Quiet and the key hint (`Ctrl K`, `⌘K` on a Mac) as a small `kbd`; it opens the palette, which searches, goes to any page or date, and captures. Then the three groups, each an Overline heading over its links: Hanken 500 Ink Secondary with 18px icons, the hint as the link's tooltip. The current page is a raised Sheet tab: Ink text at 600, an inset Hairline Soft edge, a 1px shadow, and a 3px Ink tick at its leading edge that marks the state on its own. Hover is Hover Tint. Then, under a Hairline Soft rule, **Open today, by area**: each area a link in 13px Ink Secondary that narrows the page to it (Filters), with each open count as a 6px pill bar in Ink Quiet at 55% opacity (8px plus 7px per open item, capped at 72px) and the number spoken to screen readers; the area shown takes the raised Sheet tab and Ink tick. Last, pinned to the foot, one **Account** row.
- **Account menu:** the Account row (settings glyph, the word, a small up chevron) opens a native `popover` just above it, 184px wide on Sheet with a Hairline border, 8px radius and the Float shadow: Settings, Theme, Sign out (a real POST form), then Privacy and Terms in 12px Ink Quiet under a Hairline Soft rule. It lifts 4px and fades in over 160ms (none under reduced motion). Opening it moves focus to Settings; Tab walks its items in order; Escape or a click outside closes it and focus returns to the row, which carries `aria-expanded`. On a Settings page the Account row takes the raised tab and tick, as More does on a phone. Every row is 44px under a coarse pointer.
- **Phone (below 760px):** three pieces instead of the rail. A 56px header on Music Paper with a Hairline Soft rule under it: the wordmark, and the palette as a 44px search-glyph button ("Search or go to"). A bar fixed to the bottom on Rail Paper with a Hairline top edge, 64px tall plus the safe area: Today, Week, Due and Inbox (the table's order), each a 20px icon over an 11px label in Ink Quiet, then More. The current tab is Ink at 600 with a 24 by 3px Ink tick on its top edge (the rail's tick turned on its side); More takes the tick when the page is one of its own. More opens a native `<dialog>` sheet that rises from the bottom (320ms on the house curve, none under reduced motion) on Sheet with 14px top corners, a grabber, the Float shadow and the palette's backdrop. It holds Search, then each group that has places off the bar (Plan: Month; Library: Lists, Notes, Tags), then Open today, by area (the areas as 44px pills that wrap, the shown one ringed in Ink), then Account (Theme, Settings, Sign out), each section under a Hairline Soft rule and an Overline heading, each place a 48px row in 15px with its hint as a 13px Ink Quiet second line, and Privacy and Terms last. Escape, a tap on the backdrop or a link closes it, and focus returns to More. The page ends 64px above the bar.
- **Palette:** its Go to entries are the same places plus the Guide, each with its hint in 13px Ink Quiet at the right and, from 760px, its G key as two `kbd` caps ("G I"). With nothing typed it lists, first, the item the screen has selected, then **Recent**: the last four days, weeks, months, notes or tags this browser opened that are not places, by their page title (kept in `localStorage` as `axiis-recent`, read only once the dialog is open, so nothing server-drawn depends on it). Its status line then suggests what to type ("Try “next friday”, “nov 3”, a #tag, or a line to capture.").
- **Capture from anywhere:** `C` goes to the page's capture field where it has one (Today, any day, Week, Month, Inbox, Lists); on every other page it opens the palette, which captures.
- **Day, week and month steps:** one Day, Week, Month switch first (a segmented control, the current span filled with Ink), then Previous and Next joined as one outlined pair (they never wrap apart), then the date field (the Month's Jump to month), then Today, This week or This month when away from it. The same order on all three, so the switch never moves. The switch keeps the date in focus: the day, the week holding it, the month holding it (from a week or a month, today when it holds today, else its first day). Below 760px Previous and Next are their chevrons alone (44px square, still named "Previous week, 12 to 18 October" and so on), so the switch and the pair share one row. All 36px tall, 44px under a coarse pointer. The Month's neighbours are fetched only once a pointer rests on Previous or Next or focus reaches them. Every link in the row, the switch included, keeps the page's area or tag filter (`useKeepFilter`).
- **The Week on a phone** opens at its first day, so the at-a-glance line stays in view, and when today is a later day of it a quiet "Jump to today, Friday" link (a down arrow, 44px) sits above the days and scrolls to today's heading. From 50rem, where the seven days stand side by side, the link is gone.
- **The detail panel and history:** opening an item adds a history entry and picking another item replaces it, so the browser's Back closes the panel and Forward opens it again; closing (Escape, the close button, deleting) steps back over the entry it added, or replaces the address when the panel came from a link. Escape closes it from anywhere on the page unless something closer used the key (a text field, a dialog or popover, a drag, a row that closes it itself), and focus goes back to what opened it. One `useItemSelection` hook (`src/features/detail/use-item-selection.ts`) does this for every screen.

### The undo note
`UndoToast` (`src/components/undo-toast.tsx`): after a change that moves something out of sight (an Inbox item planned or ticked done), one note floats centred over the page's foot, 24px up beside the rail, 12px above the bar on a phone: Sheet, a Hairline edge, 8px radius, the Float shadow (it floats), 14px Ink text such as "Read the lease is planned for tomorrow.", and an underlined Undo text button, 36px tall, 44px under a coarse pointer. It rises 8px as it arrives (none under reduced motion), stays six seconds, waits while a pointer rests on it or focus is inside it, and Ctrl Z or ⌘Z does what Undo does while focus is not in a text field. Undo says what it did in the same place ("Read the lease is back in the Inbox.") and puts focus back on the item. Only the words are the `role="status"`, so a screen reader hears the news, not the button. No verdigris, no icon, never red. A failed save still says so in the page's own status line under the capture field.

### Clearing the Inbox
Each row's Plan for opens Today, Tomorrow and Next week (the first day of next week) as outlined buttons, then Another day with its date field. From the keyboard, J and K or the arrows move between titles, and on a row in focus 1, 2 and 3 plan it, 4 opens its date field. Each choice shows its digit as a 12px Ink Quiet figure after its word on a fine pointer only, and one Ink Quiet line under the list says the keys (on a fine pointer only). Planning moves focus to the next title, so the keys can clear the list without the mouse. An Inbox emptied on this visit says "All planned." before its usual empty line.

### Loading
A loading page is drawn in the shape of the page it becomes, in Press Tint strokes and real hairlines, breathing slowly (`animate-breathe`, 2.4s, opacity to 45%; still under reduced motion). A day draws its title, the capture field's outline, the hour axis at 76px and three 85px staves with a 104px label column; a week draws seven ruled day columns; a month draws its weekday heads and five ruled weeks of day cells, 8rem tall when wide and 56px when compact; Inbox and Lists draw the capture outline above their ruled rows; the other list pages draw ruled rows only. Each is one `role="status"` that says Loading.

### The Month
A calendar of one month, `/month` for this one and `/month/<YYYY-MM>` for any other, drawn in `src/features/month/`. The server works out every day; the page only draws.
- **Grid:** whole weeks from the week's first day (Monday, `WEEK_STARTS_ON`) on or before the 1st, five of them, six when the month needs a sixth. Square ruled cells (Hairline) under a row of weekday heads in 12px Ink Secondary (`Mon`, or `Mo` when compact). Days of the months either side keep their marks and set their number in Ink Quiet. The 1st names its month beside its number ("1 Oct"), so a row that crosses months reads at a glance.
- **Today:** its number on an Ink disc with Paper text, the place-in-time version of the Ink-for-Selection Rule. Verdigris stays for a live item's glyph, the drop target under a drag (Verdigris Wash), a selected item (wash and ring) and focus.
- **Marks:** at most three a day, sent from the server with a count of the rest. Day-only items first in area order, then timed ones by start, then due dates. Each is one 22px line: the glyph at 72% (its head and line form carry type and state), the start time in Ink Quiet, then the title, truncated by CSS. A later day of an item that runs past midnight says "to 01:00" and is not draggable. A due date reads "Due", or "· due" after a planned time on the same day. The area is in the mark's name and tooltip, and on the phone's day list. The mark's name starts with its time and due word, as drawn. "+2 more" links to the day.
- **Compact (the month column under 36rem: phones, and a tablet beside the rail):** cells are 56px tall and show the number over up to three 6px dots (Ink filled while planned, a hollow ring once done, Verdigris while live) and "+N". The chosen day is tinted with Hover Tint and listed under the grid in 44px rows (glyph, time, title, area), with a link to open it. A first tap chooses a day, a second opens it.
- **Keys and pointer:** the grid is an ARIA grid with one focusable day (roving tabindex), named by its content: an `sr-only` "Wednesday 14 October, 3 items", then its marks. Arrows move a day or a week, Home and End go to the week's ends, Page Up and Page Down keep the day of the month in the next or last month, Enter or a click opens the day (Today when it is today). Tab reaches the focused day's items. Marks drag to another day with the Week's gesture and its move action; a click or Enter on one opens the detail panel through `?item=`.
- **Capture:** the tool row's field is labelled with the day in focus, and a line that names no day lands on it.
- **Jump to month:** an outlined button with a calendar glyph after Previous and Next opens a native popover (`src/features/month/month-picker.tsx`) on Sheet with a Hairline edge, 8px radius and the Float shadow, 288px wide (never wider than the window less 32px), placed under the button and held 16px inside the window. A year stepper (two chevron buttons either side of the year in Besley) sits over the year's months in rows of three, 44px tall. The month on screen is filled with Ink (`aria-current="page"`); this month carries a 2px Ink tick under its name (Paper on the filled month), marked in Ink as the grid marks today and says "this month". Arrows move a month or a row and cross into the next or last year, Page Up and Page Down move a year, Home and End go to January and December, Enter or a click goes to `/month/<YYYY-MM>`. Escape or a click outside closes it, and focus returns to the button. The palette also goes to a month: "month november" (the next one, this month included), "nov 2026" or "2026-11".

### Note Toolbar
A sticky bar over the note body, held to the body's 68ch measure, with a Hairline Soft rule beneath. Its 32px icon tools (44px on touch) sit in three named groups: Type (Heading, Subheading, Quote, Code), Style (Bold, Italic, Link) and Lists (Bulleted, Numbered), each name in 12px Ink Quiet from 640px and spoken only below. It stays on screen while the note is open, so the tools are found without focusing the body first. A pressed tool is filled with Ink.

### Motion
Movement is spent on three moments, each on the house curve and each dropped under `prefers-reduced-motion`:
- **A change of page** (a new path, not a new query): React's `<ViewTransition>` in `src/components/shell/page-transition.tsx`. The old page fades in 120ms; the new one waits 80ms, then fades in over 220ms while rising 6px over 360ms. The rail does not move. A change of query (the selected item, Score or List) is the same page and keeps the Score and List morph.
- **The detail panel arriving:** 16px in from the right beside the page, 8px up when it stacks under it, 320ms. Movement only, no fade, so its text is never measured half-transparent.
- **A sheet rising:** the phone's More sheet, 320ms from below; the palette and Guide keep their 200ms rise.
The done sweep on a glyph and the beam glide stay as they were. Hover and press only ease colour (140ms).

### Landing and motion on the public pages
The signed-out site (`/`, `/login`, `/privacy`, `/terms`) is the one place Axiis moves for its own sake, and even there the motion is the Score's own: lines are ruled, beams slide onto them, the now line sweeps, an item is dragged onto a line. Nothing bounces, glows or floats, and nothing is decoration that the app does not draw.

**Principles.**
- **Motion says what the app does.** Every moving thing is a gesture or a state change Axiis has: ruling a staff, a beam arriving, the now line, a drag ghost settling into a dashed beam, a tick sweeping a beam hollow, Focus folding a day.
- **First paint is final.** The headline, the lead, the way in and the Score are drawn by the server in place. The headline never animates (it is the largest paint), and a section is held back only after script has seen it is below the fold (`src/features/landing/reveal.tsx`), so no script, a slow phone or a reader who jumps down never meets a blank page.
- **Compositor only.** Everything that moves on its own moves by `transform` and `opacity`. The now line rides a layer the width of its track and is moved by a share of its own width, so the sweep and the minute step never re-lay the page. Layout shift is 0 (measured).
- **No scroll-jacking.** Scrolling is the browser's. Depth layers use CSS scroll-driven animations (`animation-timeline: scroll()` and `view()`) where the browser has them; elsewhere they simply stand still.
- **Reduced motion is a complete page.** Under `prefers-reduced-motion: reduce` every keyframe, loop, reveal, glide and view transition is gone and the composition is the same, already drawn. `e2e/landing.spec.ts` checks that nothing is running or held back.

**What moves, and how long.** All on the house curve `cubic-bezier(0.16, 1, 0.3, 1)` unless named.
| Moment | What | Timing |
|---|---|---|
| Arrival: staves | each staff line scales in from the left | 900ms, 120ms + 110ms a staff + 60ms a row |
| Arrival: beams | each beam slides 18px in and fades | 640ms, from 520ms, 65ms apart in staff order |
| Arrival: now | the now line and its flag sweep from the window's first hour to now, the flag fading in | 1.8s, `cubic-bezier(0.65, 0, 0.35, 1)`, from 450ms |
| The minute | the now line steps to the new minute | 700ms transition |
| The loop | the first Inbox chip lifts 3px and fades to 35% (a held chip), its dashed verdigris ghost slides 28px onto Health with its time, settles as a dashed beam, and all goes back | every 14s from 3.2s; paused while the score is off screen |
| Headline staff | the five lines under "on one page." rule in from the left | 1100ms, 70ms apart |
| Sections | a held section rises 22px and fades in as it enters | 700ms fade, 900ms rise, 90ms between a movement's text and its demo |
| Depth | a far staff (lines 44px apart, barred every 33vw) drifts 38vh over the first screen of scroll, a nearer fine staff 18vh; each rehearsal mark drifts 28px across its pass through the viewport | scroll-linked, linear |
| A captured line changing rows | choosing an example moves the item between its day's line, Any time and the Inbox (a named view transition); typing changes it in place, since a transition holds the page while it snapshots and would drop keys | 400ms |
| A beam moving in a demo | the beam glides to its new time | 280ms, none while a pointer holds it |
| Focus | kept rows move into place, folded rows fade out, the fold line fades in (view transitions) | 400ms move, 160ms out, 260ms in after 120ms |
| A change of public page | the old page fades and drops 8px, the new one rises 12px and fades in; the brand mark (`brand-mark`) moves on its own from where it was to where it is | out 140ms, in 260ms fade and 520ms rise from 100ms; mark 520ms |
| Day and night | the new theme is drawn in over the page from the left, the way the now line moves (a view transition of the root, clipped) | 620ms, `cubic-bezier(0.65, 0, 0.35, 1)` |
| The way in | its beam turns from dashed to solid under the pointer; a press sinks 1px | 220ms, 120ms |

**The live score.** The hero's Score is a made-up day laid around the visitor's own time (`useNowMinutes`, minute by minute): its beams are fixed in hours from the top of the current hour, so the same beam is always on now and the others always on their side of it, and only the clock words change. The server cannot know the visitor's clock, so it draws 11:20 and the browser moves to the real time once it is running. A 24-hour and 12-hour switch beside the caption redraws it on either clock, for this drawing only.

**The demos.** Each movement of the story (rehearsal marks A to E, a 30px box in Besley over each title) carries the thing itself, working, with nothing saved: capture read by the app's own `parseCapture` and `previewWords`; one beam that drags, resizes and answers the Score's keys (arrows a quarter hour, Shift and an arrow its end, Escape to cancel a drag); the done box on rows and a staff above them; Focus with its fold; and this month's grid with made-up marks, the Month's keys and a list of the day in focus or under the pointer. Each has a status line for what changed.

**The footer** opens on the final barline, then the name, one honest paragraph (free, no ads, no analytics, no trackers; export or delete from Settings) and two short link groups under Overline heads, the one place outside the rail and the More sheet that the Overline is used.

### Command Palette
A native `<dialog>` in Sheet, 560px wide, 12px radius, Dialog lift shadow, rising 8px with a 0.985 scale-in over 200ms. Options are 40px tall; the active option takes Verdigris Wash.

### Guide
All help lives in one place. The Guide is the palette's dialog (same Sheet, width, radius, lift and rise), titled Guide in Besley 20px. It opens on the screen's own topics, each a section under a Hairline Soft rule with a 17px Besley head (Capture words, Moving beams, Moving between days), then "What you see" on every screen (each kind's glyph, each line form, the words Inbox, Any time, Passed, Due and Left over, then What the colours mean: a dot is the area or tag it belongs to, None draws none, and no colour means late or done; with "Take the tour again"), then every keyboard shortcut. Capture words are a two-column definition list from 480px: the term in 13px Ink 500, the words in 13px Ink Secondary, with one specimen line set in a Hairline box on Paper.
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
- **Do** keep copy quiet and plain: sentence case, no exclamation marks, no guilt about overdue items ("Past due", never a count of days late; "For things that belong to the day but not to an hour."). One name for one thing: the pile with no day is the Inbox everywhere.

### Don't:
- **Don't** colour-code item types, or give an item a colour of its own; type is the glyph's head shape. An area's or a tag's colour is the person's choice from the palette, shown only as a dot beside its name.
- **Don't** add Verdigris, any hue near it, or a status red or green to the palette.
- **Don't** use verdigris for success, decoration, icons or headings.
- **Don't** add shadows to cards or rows; only floating layers (the palette, a dragged chip) are lifted.
- **Don't** set controls, labels or metadata in Besley.
- **Don't** add gradients beyond the ruled-line patterns that draw staves and dashes.
- **Don't** use exclamation marks, streaks, overdue reds or productivity-guru copy.
