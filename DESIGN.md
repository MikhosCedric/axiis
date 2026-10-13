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
  on-verdigris: "#f3eee1"
  scrim: "rgb(8 7 10 / 0.48)"
  night-paper: "#16151b"
  night-rail: "#1c1b22"
  night-sheet: "#201f27"
  night-ink: "#ece5d3"
  night-ink-secondary: "#bdb7a8"
  night-ink-quiet: "#9d978a"
  night-hairline: "rgba(236, 229, 211, 0.3)"
  night-hairline-soft: "rgba(236, 229, 211, 0.12)"
  night-field-stroke: "rgba(236, 229, 211, 0.5)"
  night-verdigris: "#45c7b0"
  night-verdigris-wash: "rgba(69, 199, 176, 0.16)"
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

The surface is warm music paper in light and a deep ink-blue night in dark, both on one set of shared tokens. Depth comes from hairlines and tonal paper steps, almost never from shadow. Type pairs Besley, a bookish serif with high contrast, for headings, staff names and the wordmark, with Hanken Grotesk for everything a hand operates. The interface is quiet by default and spacious, and its one loud moment is the colour of now.

This is the incumbent system as shipped in `src/app/globals.css`, `src/features/**` and `src/components/**`, extracted from code. It rejects the blank-canvas SaaS look, blue or purple gradients, guilt badges and per-type colour coding.

**Key Characteristics:**
- One hour axis shared by every area, read left to right.
- State is drawn as line form; colour is reserved.
- Verdigris appears only for now, a drag target, the focused or selected thing, and the one public Sign in action.
- Engraved hairlines and paper tones carry structure; shadows are rare and functional.
- Serif for what you read, sans for what you operate, tabular figures for every time and count.

## Colors

A two-ink, one-pigment palette: warm paper, near-black ink in three strengths, and a single verdigris that is spent sparingly.

### Primary
- **Verdigris** (`verdigris`, dark `night-verdigris`): the colour of now. It fills the playhead line, the clock flag on the hour axis and the live beam. It also draws the drag ghost (dashed outline over its wash), the selected-label underline, the focus ring, the caret, text selection, and the landing page's one Sign in button.
- **Verdigris Wash** (`verdigris-wash`): a 14% tint (16% in dark) for a drop target under a drag, a selected row in Inbox and Lists, the active palette option, and the hover state of quiet controls.

### Neutral
- **Music Paper** (`music-paper` / `night-paper`): the page ground, also written into the browser theme colour and the manifest through `src/lib/theme-colors.ts`.
- **Rail Paper** (`rail-paper` / `night-rail`): one step darker, used for the nav rail and the public header's hover.
- **Sheet** (`sheet` / `night-sheet`): one step lighter, for raised writing surfaces: the capture input, chips, the palette dialog, and the inner fill of a done glyph's head.
- **Engraving Ink** (`engraving-ink` / `night-ink`): primary text, planned beams, the current nav item's fill and the ink button.
- **Ink Secondary** (`ink-secondary`): supporting text, quiet control labels.
- **Ink Quiet** (`ink-quiet`): metadata, hour numerals, placeholders, done items and their glyphs.
- **Hairline** (`hairline`): staff borders, section rules, outlined buttons and chips at rest.
- **Hairline Soft** (`hairline-soft`): the five staff lines, the faint hour gridlines inside a staff, and row separators.
- **Field Stroke** (`field-stroke`): input borders and the hover border of chips and quiet public buttons. It is the only stroke strong enough to mark a control boundary on its own.

### Named Rules
**The Now Rule.** Verdigris means now, a drag target, or the focused or selected thing. It never marks an item type, an area, a category or a success message. A screen with no now and nothing focused carries almost no verdigris.

**The Ink-for-Selection Rule.** The current navigation item and the active segment of a toggle are filled with ink, not verdigris. Place in the app is shown in ink; verdigris is kept for time and focus.

**The No-Type-Hue Rule.** PRODUCT.md allowed a small set of item-type hues. The shipped system uses none. Type is shown by glyph shape (see Components), so do not introduce type colours without revisiting that decision.

## Typography

**Display Font:** Besley (with Georgia, serif), loaded through `next/font/google` as `--font-besley`.
**Body Font:** Hanken Grotesk (with system-ui, -apple-system, Segoe UI, sans-serif) as `--font-hanken`.

**Character:** Besley gives headings the cut of a printed programme; Hanken Grotesk is neutral, compact and legible at 12 to 14px, where most of the app lives.

### Hierarchy
- **Display** (500, `clamp(2.6rem, 1.4rem + 5.2vw, 5.25rem)`, line-height 1, -0.025em, balanced, max 13ch): the landing page headline only.
- **Headline** (500, `clamp(28px, 3vw, 40px)`, 1.1, -0.015em): every app page title (Today's date, Week, Inbox, Lists, Notes, Tags, Search, Settings). Landing section heads use a larger clamp (`1.6rem` to `2.25rem`).
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

Spacing follows Tailwind's 4px scale. Controls use 8px and 12px gaps, sections inside a page are separated by 28px (`mt-7`), and public sections by 96px to 128px. The public site is a single column capped at 1180px with 16px gutters (32px from 640px). Prose is held to 34ch to 72ch. Density is spacious by default. Settings has a Compact choice that tightens list rows only: the rows of Inbox, Due, Lists, a tag's page and the Score's List view, through `--row-y` (cookie `density`, `data-density` on `<html>`). The Score's staves and the Week are the same in both.

## Elevation & Depth

The system is flat. Structure is drawn with hairlines and three paper tones (Rail Paper, Music Paper, Sheet). Shadow appears only where something genuinely floats above the page.

### Shadow Vocabulary
- **Dialog lift** (`box-shadow: 0 24px 56px -16px rgb(14 12 10 / 0.38), 0 2px 6px rgb(14 12 10 / 0.12)`): the command palette, over a `rgb(8 7 10 / 0.48)` backdrop.
- **Drag lift** (`box-shadow: 0 6px 18px rgba(28, 27, 34, 0.22)`): the floating copy of a chip while it is dragged off the staves.
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
- **Beam:** a glyph stretched to its duration on a staff, label above in 13px Label with its start time in 12px Ink Quiet. Focus ring sits 6px off the beam. Selected shows a 2px verdigris underline on the label. The right 12px (24px on coarse pointers) is a resize grip.
- **Playhead:** a 2px verdigris rule through every staff at now, with a verdigris clock flag in the axis.
- **Drag ghost:** a 9px dashed verdigris outline over Verdigris Wash, with the target time range in 12px verdigris 600 above it. The staff under the pointer takes Verdigris Wash; the tray takes a 2px dashed verdigris outline.
- **Motion:** beams glide to new positions in 0.28s on the house curve and stop easing while tracking a pointer.

### Buttons
- **Shape:** gently rounded (6px); outlined variants 6px to 8px.
- **Public primary:** Verdigris fill, On Verdigris text, 15px 600, 12px by 20px. Hover mixes 14% ink into the verdigris over 150ms. Used only for Sign in.
- **Public quiet:** hairline border, ink text, same size; hover strengthens the border to Field Stroke.
- **Ink:** Engraving Ink fill, Paper text, 500. The in-app primary action (New note, Search, Delete account once confirmed). Hover drops opacity to 0.9.
- **Outline:** hairline border, 6px by 12px, hover Verdigris Wash. Secondary in-app actions.
- **Text and icon:** borderless, Ink Secondary, 32px square for icons; hover takes Verdigris Wash and Ink.
- **Focus:** a global 2px verdigris outline with 3px offset on every `:focus-visible`.

### Chips
- **Style:** Sheet fill, hairline border, 8px radius, 8px by 12px, 500 weight, glyph at 28px wide, then title, repeat mark, subtask count and up to two tags.
- **State:** hover strengthens the border to Field Stroke; selected turns the border verdigris and doubles it with an inset ring; done drops to Ink Quiet at 400; lifted fades to 35%.

### Inputs / Fields
- **Style:** Sheet fill, Field Stroke border, 8px radius, 10px by 14px. The capture field carries an inline `C` key hint and a status line beneath for "Saving" or an error.
- **Focus:** the global verdigris ring; the caret is verdigris.

### Navigation
- **Rail:** Rail Paper, wordmark in Besley 600 with the crossing-axes mark, links in Hanken 500 Ink Secondary with 18px icons. The current page is an Ink-filled pill with Paper text. Hover is Verdigris Wash. Areas list each open count as a 6px pill bar in Ink Quiet at 55% opacity, 8px plus 7px per open item, capped at 72px.
- **Mobile:** the same links in a single horizontal scrolling row; utility actions keep icons and hide labels.

### Command Palette
A native `<dialog>` in Sheet, 560px wide, 12px radius, Dialog lift shadow, rising 8px with a 0.985 scale-in over 200ms. Options are 40px tall; the active option takes Verdigris Wash.

## Do's and Don'ts

### Do:
- **Do** show an item's state with its line form: dashed planned, solid live, hollow done.
- **Do** reserve Verdigris (`#0a675a`, dark `#45c7b0`) for now, a drag target, focus or selection, and the public Sign in.
- **Do** fill the current navigation item with Engraving Ink, not verdigris.
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
