# Why a busy day feels lost and overwhelming

The owner, using Axiis for real: "I feel kind of lost and overwhelmed. I find it hard to differentiate certain tasks and see where I am at." This is the diagnosis behind the `ux-clarity` branch, then what it changed.

## How it was looked at

A busy week seeded around the real today (the `busy` fake account in `src/lib/supabase/fake-account.ts`, picked with the cookie `axiis-e2e-account=busy`): 13 items on today across three coloured areas (Work Slate, Home Ochre, Health Moss), one happening now, three done, a weekday standup series, two left over from earlier days, one past due, one due today, four in the Inbox, two checklists, a note and five more items through the week. The browser-test build was served with its clock moved to 14:20 so the day is seen mid-afternoon, and every page was captured at 1440 and 375, light and dark, as someone in their first week. The captures are not committed; they sit in the agent's scratchpad (`before/` and `after/`, named `<page>-<width>-<theme>.png`).

The review followed impeccable's critique (cognitive load, Nielsen heuristics) in a single context, without its two isolated sub-agents.

## What makes a person lost

1. **No "you are here" in time.** Today's title is a date and its summary counts ("7 open, 3 done today. 4 waiting."). Nothing says how far through the day you are, what is next, or that it is today at all. The only sign of now is the verdigris playhead, and on a phone it is below the fold: the first 650px of Today at 375 are title, summary, Day/Week, Previous/Next, a date field, the capture field, Score/List and Guide, then the left-over strip. The first item of the day appears at about 700px (`today-375-light.png`).
2. **The first thing on the page is the past.** The left-over strip ("2 things from earlier days are still open") sits between the tools and the day, so the eye lands on yesterday's debt before today's plan (`today-1440-light.png`).
3. **Everything has the same weight.** Any time, the Inbox tray, left over and the Score all draw items as the same Sheet chip or row. Done items sit among open ones in Any time ("Water the plants"), in the Week's day columns and in the Month's three marks a day, where a done item can push an open one into "+7 more" (`month-1440-light.png`). Nothing is first.
4. **A missed time looks like a coming one.** At 14:20 the 12:30 Dentist and the 09:30 Standup still read as dashed "planned", exactly like the 16:00 Design sync. The line forms say planned, happening, done; there is no "this time has passed" reading, so the day cannot be read left of the playhead.
5. **Types are hard to tell apart.** Task (round head) and checklist (2px square head) differ by a 12px corner. An event's two end ticks read as a bracket only when you know to look. The printed key explains Planned, Happening and Done for a task glyph only; it never says what an event or a checklist looks like, so the shapes are never learned. On the Score an event (fixed) and a task (flexible) are both beams with a start time; neither says how long or whether it can move.
6. **Due dates are invisible outside Due.** "Send the invoice" is due today and sits in Any time looking like everything else. On the Due page the one past-due item is in a group called "Earlier", and the only sign is small "Was due" metadata.
7. **One pile has three names.** The page is Inbox; its section is "Waiting"; the tray under the Score and the Week is "Waiting"; its explanation is "No day yet"; the place hint is "Waiting for a day"; and Any time (has a day, no hour) sits next to it. Due's "Earlier" means past due. A newcomer cannot tell Inbox from Waiting, or Waiting from Any time, and the code calls the same thing unscheduled.
8. **The Week loses today.** On a phone the Week starts at Monday, so on a Friday today is four screens down (`week-375-light.png`). Past days look the same as coming ones. Today's number is a verdigris disc on the Week and an Ink disc on the Month.
9. **Too many things ask for attention at once.** On Today at 1440 there are five outlined controls in the head, the capture field, a two-way switch, the Guide, three "Move to today" buttons, three Any time chips, the Score and four Inbox chips, each at the same contrast. The cognitive-load check fails on single focus, visual hierarchy and chunking (more than four peers in the tool row and in every chip group).
10. **No orientation for a newcomer.** The first day draws example beams, which is good, but nothing ever says what the Score, the Inbox, Due and Lists are for, or how they differ. The Inbox, Due and Lists heads give a count but not a purpose ("4 items waiting.").

Heuristics, scored 0 to 4 on the signed-in day screens: visibility of system status 1 (no now or next outside the playhead), match to the real world 2 (Waiting, Any time, unscheduled), user control 3, consistency 2 (three names for one pile, two today markers), error prevention 3, recognition over recall 1 (types and places must be remembered), flexibility 3 (keys, palette), minimalist design 2, error recovery 3, help 2 (the Guide covers keys and capture words, not what things mean). 22 of 40.

## What changed

Each is its own commit on `ux-clarity`.

- **Where am I.** Today and every day open on an at-a-glance line under the date: where the day is ("Today", "Tomorrow", "3 days ago"), how far through it you are ("3 of 8 done") and what is next ("next: Design sync at 16:00"), or "Nothing left today". A thin ruled line under it fills in Ink as items are done, line-form, not a donut. The Week and the Month say the same for their span ("This week · 2 days left · 5 open · 2 due").
- **Next up.** The top of Today names the next one to three things (happening now first, then the next times, then due today), each with its done tick.
- **Focus.** A Focus switch on Today shows only Now, Next and what is due today; the rest of the day, the Inbox, left over and done fold into counted lines that open in place. It is kept per device in the `focus` cookie, like Density.
- **Done folds away.** Done items in Any time and the Inbox tray fold into one quiet "Done (n)" line.
- **Types and states read at a glance.** The printed key also names the shapes (task, event, checklist), events say their whole time on a beam and a row, and a timed item whose time has passed while still open says so in quiet words. Due today and past due carry one quiet "due" mark wherever an item is drawn.
- **One vocabulary.** The pile with no day is the Inbox everywhere; "Waiting" is gone. Any time means on a day, at no hour. Due's first group is "Past due".
- **Orientation.** Inbox, Due and Lists say what they are for under their title. A four-step tour (capture, the Score, Inbox and Today, the Guide) runs once on a new account, can be skipped, and can be replayed from the Guide.

What was left out, and why, is listed in `docs/PROGRESS.md` under this branch's log entry.
