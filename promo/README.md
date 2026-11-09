# Axiis promo film

A 40 second film, a 15 second cut, a muted hero loop and a poster, all drawn by one deterministic web page in the
product's own tokens and type, then rendered frame by frame with Playwright and encoded with ffmpeg.

| File | What | Committed |
|---|---|---|
| `out/axiis-promo.mp4` | 40 s, 1920x1080, 30 fps, H.264 crf 16, yuv420p, faststart, silent | no (local artifact) |
| `out/axiis-promo-15s.mp4` | 15 s social cut, same settings | no (local artifact) |
| `out/axiis-hero-loop.webm` | 9 s seamless loop, 1280x720, VP9, muted (0.71 MB) | yes |
| `out/axiis-poster.jpg` | still at 12.5 s: the day with now crossing the live beam | yes |

Source: `index.html` (stage), `style.css` (tokens copied from `src/app/globals.css`, both sides of `light-dark()`, and
the product shapes: glyph, sheet, staves, chips, cards, capture field), `film.js` (every scene and the one master
timeline), `render.mjs` (the renderer), `fonts/` (Bricolage Grotesque and Hanken Grotesk, latin subsets, the same
woff2 files `next/font` self-hosts; both are SIL OFL).

## Storyboard

Cut points sit on a 120 BPM grid (a beat every 0.5 s, a bar every 2 s), so a track at 120 BPM lines up with every
scene change: the pan into the day lands on bar 4 (6 s), the hard cut to Connect is bar 10 (18 s), the night wipe
starts on 25.7 and settles on bar 13 (26 s), the wipe back to day is bar 17 (34 s).

| Time | Shot | On screen |
|---|---|---|
| 0.0 to 2.8 | Close on the capture field, camera drifting. The C key presses, the field takes focus (verdigris ring and caret), "Call the vet from the train" is typed with seeded human timing. | key cap "C · from any page" |
| 2.8 to 3.3 | Enter. The typed line lifts out of the field as a chip and springs into the Inbox; the rows make room, the count goes 3 to 4. | |
| 3.3 to 5.4 | The camera pulls back to the page. | "Write it down now. / Sort it out later." and "Press C on any page. Two seconds, and back to your day." |
| 5.4 to 6.8 | Camera pans right while the sheet of the day rules itself in: staff rules, five-line staves, hour barlines, then each beam drawn left to right. | |
| 6.8 to 9.3 | The hand picks the chip out of the Inbox (it lifts, takes the verdigris drag outline, tilts slightly) and carries it on an arc to the Home staff; a slot snaps along the quarter hours to "12:30 – 1:15". | "Drop it on the day." |
| 9.3 to 10.2 | Let go: the chip collapses into a dashed planned beam with a spring. | "Now it has a time." |
| 10.2 to 12.4 | The verdigris now line drops through the staves at 11:52, then runs to 12:31; as it crosses 12:30 the beam fills solid verdigris and its label takes weight. | clock flag, tabular |
| 12.4 to 14.1 | Camera pushes in toward the beam; the Next up card rises in. | |
| 14.5 to 15.4 | Click on the head: the ink sweep fills the beam, then it turns hollow (done). The same glyph in Next up sweeps too, and the list closes up (Design sync, Run, Packing list). | "Done, without the fanfare." |
| 18.0 | Hard cut. A smaller Today panel; the vet item takes focus, a note card unfolds beside it and a hairline draws from the task to the note's link. | "Everything connects." Note: "Notes for the vet" |
| 21.2 to 22.2 | The note leaves, the panel widens. | "One item. Every view." |
| 22.4 | The hand clicks Week: today's ten items glide (staggered, on a slight arc) from the staves into Tuesday's column; the rest of the week ripples in around them. | |
| 23.85 | Month: the week's items glide into their dates, today keeps two and "8 more", November fills outward from today. | |
| 25.7 to 26.45 | A verdigris now line sweeps left to right and the page turns to night behind it. | |
| 26.5 to 29.0 | A Windows desktop at night, the Axiis window showing Today at 12:50. The hand opens the tray icon: the real tray menu ("Today · 6 of 10 done", the next three timed items, Open Axiis, Capture (Ctrl+Alt+A), Quit). | "On the desktop, too." / "Today's list, in the tray." |
| 29.2 to 30.4 | A native-style reminder slides in: "Design sync / Starts in 10 minutes". | "A reminder, ten minutes before." |
| 30.45 to 32.85 | The network drops (tray icon, "Offline" badge). Ctrl Alt A, the quick capture window, "Pick up the prescription", Enter; the product's outbox line: "1 capture is saved on this device and will be sent when you are back online." | "No connection? Capture anyway." |
| 32.85 to 33.55 | Back online: the line goes, the capture flies into the Inbox (3 to 4). | "Back online, it sends itself." |
| 33.55 to 34.25 | The now line sweeps back, right to left, to the day. | |
| 34.25 to 40.0 | A staff draws across with its final double barline; the mark is drawn stroke by stroke and its verdigris head springs in; the wordmark resolves out of blur; the line, then the one verdigris call, then the small print. Holds from about 37.8. | "Axiis" / "Where your tasks, time and notes meet." / **Start with today** / "Free for now. On the web and on Windows. Export or delete your data anytime." |

The 15 s cut takes four pieces of the master, hard cut on beats: 0.5 to 5.0 (capture), 7.75 to 12.25 (drag, drop, now,
live), 14.25 to 16.25 (done), 35.0 to 39.0 (the close). Change them in `SHORT` in `render.mjs`.

The hero loop is its own mode of the same page (`?mode=loop`): the Today page framed still, no type, the whole story on
a 9.6 s clock (capture, Inbox, drag, now crosses, live, done). The renderer dissolves its last 0.6 s into its first
0.6 s, so the webm loops with no seam (9.0 s long).

## Re-render

Needs Node 24, ffmpeg on PATH, and Playwright (already in the repo's dev dependencies). From the repo root:

```bash
node promo/render.mjs all        # film + 15 s cut + poster + loop, about 8 minutes with 4 workers
node promo/render.mjs film       # only the mp4s and the poster
node promo/render.mjs loop       # only the webm
node promo/render.mjs sheet      # a contact sheet of 12 key times -> promo/frames/sheet.png
node promo/render.mjs sheet 6.5 12.5 25.3   # a contact sheet of chosen times
MODE=loop node promo/render.mjs sheet 1 4 7 # contact sheet of the loop
```

Env: `WORKERS=4` (parallel pages), `CHANNEL=msedge` (default; `CHANNEL=` uses Playwright's own Chromium), `KEEP=1`
keeps the PNG frames in `promo/frames/`, `VP9_CRF=33` sets the loop's quality.

To scrub it live, serve the folder (for example `npx serve promo`) and open `index.html?play=1`, or `index.html?t=24.5`
for one moment. Fonts must come over http, not `file://`.

How it stays deterministic: every style is a pure function of one time value. `window.__seek(ms)` sets them all; there
are no CSS animations or transitions, no `Date`, no `Math.random` (one seeded mulberry32 PRNG drives typing rhythm, the
drifting fragments, the month's sample items and the paper grain). The renderer awaits `window.__ready` (both fonts
loaded and checked with `document.fonts.check`) before frame 0, then seeks and screenshots each frame at 1920x1080,
deviceScaleFactor 1.

## Add a music track

The film is silent. To lay a track under it (the cut points are on a 120 BPM grid, so start a 120 BPM track on its
first downbeat at 0:00), with a 1 s fade in and a 2 s fade out:

```bash
ffmpeg -i promo/out/axiis-promo.mp4 -i track.wav \
  -filter_complex "[1:a]atrim=0:40,afade=t=in:st=0:d=1,afade=t=out:st=38:d=2[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart \
  promo/out/axiis-promo-music.mp4
```

For the 15 s cut use `atrim=0:15` and `afade=t=out:st=13.5:d=1.5`. If the track has a lead-in before its first
downbeat, add `-itsoffset -<seconds>` before `-i track.wav`.

## Decisions

- One world for the first 18 s. The capture field, Inbox, sheet and Next up sit on one page and the camera travels across
  it (pull back, pan, push in), so capture, place and done read as one continuous move, not three demos. Titles are
  printed on that page and move with it.
- Light throughout, with one turn to night for the desktop. The turn is a verdigris now line sweeping across the frame,
  and it sweeps back for the close, so the only accent in a transition is still "now".
- Verdigris is spent only on: the capture caret and focus ring, the dragged chip's outline and its drop slot, the now
  line and its flag, the live beam, the focus on the linked item, the mark's head, and "Start with today". Every
  shadow is offset and neutral; there are no glows, gradients on text, eyebrows or emoji.
- Sample data is ordinary life (a vet, a landlord, a launch brief, a run). The tray menu, the reminder text ("Starts in
  10 minutes") and the offline line are the product's own strings (`src-tauri/src/lib.rs`, `src/features/day/tray.ts`,
  `src/components/shell/outbox.tsx`). The day is Tuesday 10 November; the desktop clock is 12:50 PM, ten minutes before
  Design sync, so the reminder is true to the data.
- The desktop is "Windows-style", not a copy of Windows: generic line icons, the Axiis mark in the tray, a menu and a
  reminder drawn in the night tokens and Hanken Grotesk (no system font is ever used).
- The hero loop has no type, so the site's own headline can sit over or beside it.
- Paper grain is a static seeded texture at 5% (3.5% at night), multiply on paper and screen at night; `?grain=0`
  turns it off.
- "Items open in their own window" is not shown: the desktop scene already carries three ideas in eight seconds.

## What was verified

- Contact sheets of about 40 key times, in two passes (look, fix in one batch, look again): legibility, overflow,
  contrast, cut timing, no empty frames. Fixes from the first pass: a wrapping key label, the end of the capture shot
  reframed, the Ctrl Alt A key caps moved off the window into the text column, the desktop window made shorter,
  zero-offset focus halos removed, the poster moment reframed so the Inbox is not cropped.
- `ffprobe`: `axiis-promo.mp4` h264 1920x1080 30/1 yuv420p, 40.000 s, 17.1 MB; `axiis-promo-15s.mp4` h264 1920x1080
  30/1 yuv420p, 15.000 s, 6.1 MB; `axiis-hero-loop.webm` vp9 1280x720 30/1 yuv420p, 9.000 s, 0.71 MB (crf 16; crf 33
  gave 0.2 MB but soft type); `axiis-poster.jpg` 1920x1080, 0.23 MB.
- The loop's seam sits inside the dissolve: frames 0, 120, 200 and 269 of the webm were extracted and checked.
- Fonts: the renderer will not start unless both families pass `document.fonts.check`.
- `npm run lint` and `npm run typecheck` pass with `promo/**` added to the ESLint ignores (the tsconfig only includes
  TypeScript files, so it needed no change).
- Not verified: how it plays with music (none chosen), and how the loop sits over the live site.
