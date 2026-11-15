import type { ItemType } from "@/domain/item";
import type { BeamState } from "@/features/today/model";

/*
 * What the Guide says about capture words, kinds, line forms and the words on screen. Kept apart from the
 * Guide's component so the public Help page reads the same sentences.
 */

export const CAPTURE_WORDS: [string, string][] = [
  ["Days", "today, tomorrow, a weekday, on friday, by friday, next friday, in 3 days, 2026-12-24"],
  ["Times", "9:00, 14:30, 9am, 2:30pm, at 9, or 9 and 0930 right after a day"],
  ["Length", "after a time, for 45m or for 1h 30m; otherwise 30 minutes"],
  [
    "Kept as typed",
    "everything else, a day after a word like for or until (“groceries for sunday”), a word after a backslash (\\friday), and a whole line in quotes",
  ],
];

export const KINDS: { type: ItemType; term: string; says: string }[] = [
  { type: "task", term: "Task", says: "Something to do. A round head; it can move." },
  { type: "event", term: "Event", says: "Something at a fixed time. Ticks at both ends; it says its whole time." },
  { type: "checklist", term: "Checklist", says: "A list of small lines. A square head." },
];

export const STATES: { state: BeamState; term: string; says: string }[] = [
  { state: "planned", term: "Planned", says: "Dashed: still to come, or with no time yet." },
  { state: "live", term: "Happening", says: "Solid green: its time is now." },
  { state: "done", term: "Done", says: "Hollow. Done items fold into one Done line." },
];

export const WORDS: [string, string][] = [
  ["Inbox", "What you captured with no day yet. Nothing there is late."],
  ["Any time", "On a day, at no particular hour."],
  ["Passed", "Its time is over and it was never ticked."],
  ["Due", "A deadline, apart from when you planned it. The flag fills once the day has come."],
  ["Left over", "Planned for an earlier day and still open, shown below Today's plan."],
];
