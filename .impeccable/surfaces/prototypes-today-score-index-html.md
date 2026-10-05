---
version: 1
slug: "prototypes-today-score-index-html"
primary_target: "prototypes/today-score/index.html"
related_targets: []
---

# Today (prototype)

Mode: Operate. Throwaway prototype of the Today view in `prototypes/today-score/index.html`, sample data only, code-led. Job: a busy person sees the whole day across work, home and health at once, places unscheduled items onto time, and sees what each item connects to.

## Direction contract

THESIS: Today is a score. Each part of life is a staff and one hour axis runs across all of them. It refuses the card-column task list and the generic week grid.

OWN-WORLD: Warm music-paper ground, engraved ink hairlines, five-line staves with hour barlines, one verdigris accent that means "now" and "drag target" only. Besley for headings, Hanken Grotesk for UI, tabular numerals for time. Item state is line form (solid live, dashed planned, hollow done), never coloured badges. Dark theme is deep ink with the same tokens.

STORY: The visitor understands in seconds what is happening now and what is still unscheduled. They believe nothing is lost because every capture lands on the tray. They drag a tray item onto a staff and it takes a time.

FIRST VIEWPORT: Left nav rail (Today active, areas with extent bars). Main column: date heading in Besley, quiet summary line, toolbar (capture field, Score/List switch, density, theme). Below, the score: sticky hour axis, three staves with sticky part labels, a verdigris playhead at now. Under the staves, the tray of unplaced items. Right column: a detail panel showing the selected item's connected note and checklist.

FORM: Chamber-music score (assigned index 4 of 7, seed 55c92e4f). Signature move: item beams that morph between the staff and the ranked list via view transitions.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
