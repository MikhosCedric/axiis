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
- **Headline** (500, `clamp(28px, 3vw, 40px)`, 1.1, -0.015em): every app page title (Today's date, Week, Inbox, Due, Lists, Notes, Tags, Search, Settings), always through the `headline` utility in `globals.css`, which also balances the lines. In a day's title the weekday is set in Ink Secondary, so the date leads ("Thursday 15 October"). Under every title sits one `page-summary` line (15px, 1.5, Ink Secondary). The note editor's title field is the one exception (3.2vw, 1.15), because it is a growing text field. Landing section heads use a larger clamp (`1.6rem` to `2.25rem`).
- **Title** (Besley 500, 18px to 22px): section heads inside a page (Waiting, Subtasks, Linked notes, Due's Earlier, This week and Later at 18px), staff names (16px, 19px at rail width) and the wordmark (600, 20px to 22px, -0.01em).
- **Body** (Hanken 400, 14px, 1.45): the default for the app. Page subtitles under an app headline and public body copy step up to 15px at 1.6 (Body Large), the landing lead paragraph to 17px to 18px, held to 34ch to 36rem. Note bodies are set for reading at 16px, 1.65, 68ch.
- **Mono** (system monospace, 0.88em on Rail Paper with a soft hairline): inline code in notes only.
- **Label** (Hanken 500, 13px, 20px line): beam labels, secondary actions and helper copy; the most used size in the codebase. Live beam labels go to 700, done labels to 400 in Ink Quiet.
- **Caption** (Hanken 500 to 600, 12px, tabular): hour numerals, the now flag, open counts, `kbd` keys.
- **Overline** (Hanken 600, 12px, 0.06em, uppercase): the rail's Areas heading; used once.

### Named Rules
**The Tabular Time Rule.** Every `<time>`, clock, count and date numeral uses tabular figures (`font-variant-numeric: tabular-nums`, set globally on `time` and `.tabular`). Times never jitter as they change.

**The Serif Reads, Sans Operates Rule.** Besley is for names and headings a person reads. Buttons, inputs, labels and metadata are always Hanken Grotesk.

## Layout

The app is a two-column shell: a nav rail and a content column. At 760px and up (the `rail` breakpoint) the rail is a sticky, full-height column on Rail Paper with a hairline right edge. Below 760px it becomes a horizontal top bar that scrolls sideways with its scrollbar hidden, and the Areas list and legal links are dropped.

The Score is the organizing grid. A sticky label column (`--lw`, 80px, or 104px at rail width) holds staff names. The hour axis is 76px per hour (`background-size: 76px`), each staff sub-row is 25px tall with five lines 6px apart, and beams snap to quarter hours. On the app, the axis covers 07:00 to 20:00, widened to whole hours that hold every beam and now. When its container has room for more, it gains whole hours to fill it, later ones up to 24:00 first so nothing already drawn moves, then earlier ones down to 00:00; the hour stays 76px, so what is left over is under one hour. A drag in progress keeps the axis it started on. When the axis is wider than its container, it scrolls horizontally inside it and opens scrolled to now (30% from the left) or to the first beam. On the landing sample score the visible window narrows instead (10:00 to 16:00 under 640px, 08:00 to 17:00, then 07:00 to 19:00 from 1000px), so it never scrolls sideways.

A page head with day or week steps (Day/Week, Previous and Next, the date) is a `page-head`: the steps sit to the right of the title when the page column, a `page` container, is at least 56rem wide, and in one row under the summary otherwise, so they never stack into a tower beside a wrapped title. Under the head, the tool row (capture field, any view switch, the Guide) carries one status line under the field. The screen's own news (a move, a tick, a plan) shares that line with the capture's, through `CaptureField`'s `screenStatus`, so a page reserves one line of room for news, not two.

Spacing follows Tailwind's 4px scale. Controls use 8px and 12px gaps, sections inside a page are separated by 28px (`mt-7`), and public sections by 96px to 128px. Settings is one column below 1180px. From 1180px it is two: a sticky index of its parts (Areas, Tags, Display, Your data) in an 11rem column on the left, and the sections on the right. Theme and Density sit together under Display; the rail's theme toggle changes the same setting. The public site is a single column capped at 1180px with 16px gutters (32px from 640px). Prose is held to 34ch to 72ch. Density is spacious by default. Settings has a Compact choice that tightens list rows only: the rows of Inbox, Due, Lists, a tag's page and the Score's List view, through `--row-y` (cookie `density`, `data-density` on `<html>`). The Score's staves and the Week are the same in both.

## Elevation & Depth

The system is flat. Structure is drawn with hairlines and three paper tones (Rail Paper, Music Paper, Sheet). Shadow appears only where something genuinely floats above the page.

### Shadow Vocabulary
- **Float** (`--float`, utility `shadow-float`: `0 24px 56px -16px` and `0 2px 6px`, warm ink by day, near black at night): the command palette and the Guide, over a `rgb(8 7 10 / 0.48)` backdrop.
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
- **Rail:** Rail Paper, wordmark in Besley 600 with the crossing-axes mark, links in Hanken 500 Ink Secondary with 18px icons. The current page, Settings included, is a raised Sheet tab: Ink text at 600, an inset Hairline Soft edge, a 1px shadow, and a 3px Ink tick at its leading edge that marks the state on its own. Hover is Hover Tint. Areas list each open count as a 6px pill bar in Ink Quiet at 55% opacity, 8px plus 7px per open item, capped at 72px.
- **Mobile:** the same links in a single horizontal scrolling row; utility actions keep icons and hide labels.
- **Day and week steps:** Day/Week, then Previous and Next joined as one outlined pair (they never wrap apart), the date field, and Today or This week when away from it. All 36px tall, 44px under a coarse pointer.

### Loading
A loading page is drawn in the shape of the page it becomes, in Press Tint strokes and real hairlines, breathing slowly (`animate-breathe`, 2.4s, opacity to 45%; still under reduced motion). A day draws its title, the capture field's outline, the hour axis at 76px and three 85px staves with a 104px label column; a week draws seven ruled day columns; Inbox and Lists draw the capture outline above their ruled rows; the other list pages draw ruled rows only. Each is one `role="status"` that says Loading.

### Note Toolbar
A sticky bar over the note body, held to the body's 68ch measure, with a Hairline Soft rule beneath. Its 32px icon tools (44px on touch) sit in three named groups: Type (Heading, Subheading, Quote, Code), Style (Bold, Italic, Link) and Lists (Bulleted, Numbered), each name in 12px Ink Quiet from 640px and spoken only below. It stays on screen while the note is open, so the tools are found without focusing the body first. A pressed tool is filled with Ink.

### Command Palette
A native `<dialog>` in Sheet, 560px wide, 12px radius, Dialog lift shadow, rising 8px with a 0.985 scale-in over 200ms. Options are 40px tall; the active option takes Verdigris Wash.

### Guide
All help lives in one place. The Guide is the palette's dialog (same Sheet, width, radius, lift and rise), titled Guide in Besley 20px. It opens on the screen's own topics, each a section under a Hairline Soft rule with a 17px Besley head (Capture words, Moving beams, Moving between days), then every keyboard shortcut. Capture words are a two-column definition list from 480px: the term in 13px Ink 500, the words in 13px Ink Secondary, with one specimen line set in a Hairline box on Paper.
- **Way in:** one Guide button per screen that has topics (Today and any day, Week, Inbox), always the last control of the tool row under the page header (capture field, then any view switch), pushed to the row's right edge. Outline, 8px radius, a 16px circled question mark and the word Guide; 38px tall like the Score/List switch, 44px under a coarse pointer. `?` opens the same dialog on any screen, and the palette lists it as Guide. Screens without topics show no button; there `?` opens the shortcuts alone.
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
- **Don't** colour-code item types or areas; type is the glyph's head shape.
- **Don't** use verdigris for success, decoration, icons or headings.
- **Don't** add shadows to cards or rows; only floating layers (the palette, a dragged chip) are lifted.
- **Don't** set controls, labels or metadata in Besley.
- **Don't** add gradients beyond the ruled-line patterns that draw staves and dashes.
- **Don't** use exclamation marks, streaks, overdue reds or productivity-guru copy.
