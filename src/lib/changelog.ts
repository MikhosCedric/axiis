/**
 * What has changed in Axiis, newest first, in the words a person using it would use. Dates are the days the
 * change reached the live app; each comes from `docs/PROGRESS.md`. Add an entry at the top when something
 * a person can see or use ships. Fixes that change nothing visible are left out.
 */
export type ChangelogEntry = {
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
  title: string;
  /** One or two plain sentences. No exclamation marks, no praise. */
  body: string;
};

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    date: "2026-11-14",
    title: "Done, Help, print and share",
    body: "A Done page lists what you finished, day by day, and unticking an item there reopens it. This Help page and changelog are public. Today, Week, a list and a note print cleanly. On a phone or computer where Axiis is installed, it appears in the share menu, and Capture, Today and Inbox are one press away on its icon.",
  },
  {
    date: "2026-11-11",
    title: "Notes with lists and links save again",
    body: "A note holding a numbered list, a checklist or a link could fail to save. It saves now. Saved copies of pages are removed after seven days, even if you do not open them again.",
  },
  {
    date: "2026-11-10",
    title: "Reminders, repeats in capture and more control over tags",
    body: "The Windows app reminds you before each timed item, and its tray holds a list for today. Capture reads a repeat in one step, such as every tuesday 7:30am to 9am gym. Tags can be merged, G then H goes to Tags, and Settings sets which day the week starts and which page opens first.",
  },
  {
    date: "2026-11-09",
    title: "Axiis for Windows",
    body: "A desktop app that loads Axiis in its own window, with an item opening in a window of its own and a list for today in the tray.",
  },
  {
    date: "2026-11-08",
    title: "Capture with no connection, and pages kept for reading",
    body: "A capture typed offline waits on the device and is sent when the connection returns. Pages you looked at lately stay readable offline for seven days, marked as saved copies.",
  },
  {
    date: "2026-10-27",
    title: "Actions on every row",
    body: "Each row has a right-click menu and row keys to plan it, set its area and tags, duplicate it or delete it, and a deleted item can be taken back with Undo.",
  },
  {
    date: "2026-10-24",
    title: "A new public site",
    body: "The landing page was redrawn with a sample day that runs, in light and dark.",
  },
  {
    date: "2026-10-23",
    title: "Show one area or one tag",
    body: "Choose an area or a tag and Today, Week, Month, Inbox, Due, Lists and Notes narrow to it. The choice stays as you move between them.",
  },
  {
    date: "2026-10-15",
    title: "Month, area colours and the clock you prefer",
    body: "A Month view with drag to move, a colour for each area and tag, and a 12-hour or 24-hour clock.",
  },
  {
    date: "2026-10-10",
    title: "Due, left over, and a compact density",
    body: "A Due page lists deadlines soonest first, items left from earlier days wait below Today, and Settings offers a compact density.",
  },
  {
    date: "2026-10-07",
    title: "Capture reads plain English",
    body: "Type a day, a time, a length or tags into the capture field, as in dentist tomorrow 9:00 #health, and the item lands where you meant.",
  },
  {
    date: "2026-10-06",
    title: "Repeating tasks, the palette, Inbox, Lists and tags",
    body: "Tasks can repeat on a rule and be changed for one day. Ctrl or Cmd K opens a palette to jump, search or capture. The Inbox holds what has no day yet, Lists show checklists and how far along each is, and tags have a page each.",
  },
];

/** `2026-11-14` as "14 November 2026". */
export function changelogDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
