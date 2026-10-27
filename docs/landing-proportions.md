# Landing proportions

The owner found parts of the landing too huge, and other parts flat with too much empty space (2026-10-27, after PR #93). This is the audit behind `site-redesign-3`: what was out of proportion, measured, and what each became.

## How it was measured

`node scripts/landing-audit.mjs http://localhost:3710 <out>` against a production build (`next build`, `next start -p 3710`) in Edge. For each width it records the largest computed font size of each type role, the Start button's height, the hero sheet's width, and the tallest stretch of the page that no line of text crosses ("emptiest band"), with reduced motion so every section is drawn. It also saves a full-page screenshot per width and scheme, and, with motion on, one screenshot a screen down the page at 1440 and 1920. Sizes are CSS pixels.

## What was out of proportion

`main` at `b920c63`, light (dark measures the same).

| Element | 375 | 768 | 1280 | 1440 | 1920 | 2560 | 3440 | Why it was wrong |
|---|---|---|---|---|---|---|---|---|
| Headline (display) | 41.9 | 62.3 | 93.5 | 105.1 | 140.2 | 187.9 | 192 | Grew with the window to 12rem; at 2560 it was 376px tall, eleven times the body copy beside it |
| Section heads (h2) | 28 | 29.8 | 40 | 43.2 | 52.8 | 65.6 | 68 | Grew to 4.25rem, more than the headline's ratio to them at 1440 |
| Movement titles (h3) | 23.2 | 24.4 | 31 | 33.1 | 39.4 | 46.4 | 46.4 | Grew to 2.9rem |
| Tallies (numerals) | 40 | 45.4 | 60.8 | 65.6 | 80 | 96 | 96 | Grew to 6rem; four 96px numbers in a row read as a poster |
| "Morning / Afternoon / Evening" in the run | 36 | 50.6 | 73.6 | 80.8 | 102.4 | 120 | 120 | Grew to 7.5rem, larger than the section's own head and the run's title together |
| Lead | 17 | 17 | 17 | 17.1 | 19.5 | 22 | 22 | Grew past the body by more than one step |
| Start button text, height | 15, 48 | 15, 48 | 15, 48 | 15, 48 | 15, 48 | 15, 48 | 15, 48 | Fixed while the headline above it tripled; at 2560 it looked like a caption |
| Hero sheet width | 333 | 680 | 1135 | 1277 | 1703 | 2302 | 3182 | Ran the whole window, so at 3440 the Score was a 3182px strip with 20 hours on it |
| Emptiest band | 240 | 240 | 376 | 400 | 460 | 454 | 454 | The seams between sections were 72 to 160px of margin each side of a 25px staff |

Also seen in the screenshots, not as a single number: the "How it works" head left the right half of its row empty; each movement at 1440 set a short text column beside a tall demo with nothing under the text; at 1800px and up the movements stood two by two with mostly empty sheets (the drag demo is one staff); the tallies' row and the shipped list sat on the same paper as everything else, so the page had no change of surface from top to bottom; the close section was a line of text and a button on bare paper.

## What they are now

`site-redesign-3`, light (dark measures the same).

| Element | 375 | 768 | 1280 | 1440 | 1920 | 2560 | 3440 | Ceiling |
|---|---|---|---|---|---|---|---|---|
| Headline (display) | 41.9 | 62.3 | 93.5 | 105.1 | 128 | 128 | 128 | 8rem |
| Section heads (h2) | 28 | 32.2 | 41.9 | 45 | 52 | 52 | 52 | 3.25rem |
| Movement and run titles (h3) | 22 | 24.3 | 29.1 | 30.6 | 33 | 33 | 33 | 2.0625rem |
| Tallies and the run's part of the day (numerals) | 40 | 45.6 | 57.9 | 61.8 | 64 | 64 | 64 | 4rem |
| Lead | 17 | 17.8 | 19.6 | 20.2 | 21 | 21 | 21 | 1.3125rem |
| Body, ledger | 15 | 15.5 | 16.5 | 16.8 | 17 | 17 | 17 | 1.0625rem |
| Start button text, height | 15, 48 | 15.5, 48 | 16.5, 48 | 16.8, 48 | 17, 49 | 17, 52 | 17, 54 | body, 54px |
| Hero sheet width | 333 | 680 | 1135 | 1277 | 1697 | 1694 | 1998 | the column, `--content-max` |
| Emptiest band (reduced motion) | 181 | 180 | 239 | 251 | 279 | 279 | 279 | under half a screen |

The scale and the column are tokens in `src/app/globals.css` (`--fs-*`, `--sp-*`, `--section-y`, `--content-max`), set out in DESIGN.md, Landing and motion on the public pages. `e2e/landing.spec.ts` holds each role to its ceiling at 1920, 2560 and 3440, holds prose to about 75 characters a line, and, scrolling half a screen at a time at 1440, 1920 and 2560 with motion on, fails if any half screen has no line of text.
