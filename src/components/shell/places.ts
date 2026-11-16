import type { LocalDate } from "@/domain/item";
import { DONE_PATH } from "@/features/done/model";
import { DUE_PATH } from "@/features/due/model";
import { LISTS_PATH } from "@/features/lists/model";
import { MONTH_PATH } from "@/features/month/model";
import { TAGS_PATH } from "@/features/tags/model";

/** The side panel's headings, in the order they stand (ADR-0004). */
export const PLACE_GROUPS = ["Calendar", "Tasks", "Library"] as const;
export type PlaceGroup = (typeof PLACE_GROUPS)[number];

export type PlaceId = "today" | "week" | "month" | "due" | "inbox" | "lists" | "notes" | "tags" | "done" | "search" | "settings";

/**
 * Every page a person can go to, for the side panel, the phone bar, the palette and the G-then-letter keys.
 * `group` puts a place under a panel heading; Search and Settings have none, because the panel reaches
 * them through its search field and its account menu. `tab` makes it one of the phone's four tabs.
 */
export type Place = {
  id: PlaceId;
  label: string;
  /**
   * The name in the side panel and the phone bar, where it differs. The three calendar places are
   * the only switch between the day, the week and the month there, so Today is called Day: from a
   * calendar view it opens the day that view is about, not always today.
   */
  navLabel?: string;
  /** The calendar span this place shows, and the key that switches to it from another calendar view. */
  span?: { is: "day" | "week" | "month"; key: string };
  href: string;
  /** What the place holds, in a few plain words: the panel's tooltip, the More sheet's second line, the palette's aside. */
  hint: string;
  group: PlaceGroup | null;
  tab: boolean;
  /** The key after G that goes here. */
  go: string | null;
  /** A second key after G that also goes here, not shown in the legends. */
  goAlias?: string;
  /** Other words the palette matches it by. */
  also: readonly string[];
  here: (path: string, today: LocalDate) => boolean;
};

const under = (root: string) => (path: string) => path === root || path.startsWith(`${root}/`);
const at = (root: string) => (path: string) => path === root;

export const PLACES: readonly Place[] = [
  {
    id: "today",
    label: "Today",
    navLabel: "Day",
    span: { is: "day", key: "d" },
    href: "/today",
    hint: "Your day, hour by hour",
    group: "Calendar",
    tab: true,
    go: "t",
    also: ["day", "grid", "agenda"],
    // Any single day is the day view Today opens, so the panel keeps it marked while you step through days.
    here: (p) => p === "/today" || p.startsWith("/day/"),
  },
  {
    id: "week",
    label: "Week",
    span: { is: "week", key: "w" },
    href: "/week",
    hint: "Seven days side by side",
    group: "Calendar",
    tab: true,
    go: "w",
    also: ["planner"],
    here: under("/week"),
  },
  {
    id: "month",
    label: "Month",
    span: { is: "month", key: "m" },
    href: MONTH_PATH,
    hint: "The whole month at a glance",
    group: "Calendar",
    tab: false,
    go: "m",
    also: ["calendar"],
    here: under(MONTH_PATH),
  },
  {
    id: "inbox",
    label: "Inbox",
    href: "/inbox",
    hint: "Captured, with no day yet",
    group: "Tasks",
    tab: true,
    go: "i",
    also: ["unscheduled", "waiting"],
    here: at("/inbox"),
  },
  {
    id: "due",
    label: "Due",
    href: DUE_PATH,
    hint: "Deadlines, soonest first",
    group: "Tasks",
    tab: true,
    go: "d",
    also: ["deadlines", "deadline", "overdue"],
    here: at(DUE_PATH),
  },
  {
    id: "done",
    label: "Done",
    href: DONE_PATH,
    hint: "What you finished, by day",
    group: "Tasks",
    tab: false,
    go: "f",
    also: ["completed", "history", "log"],
    here: at(DONE_PATH),
  },
  { id: "lists", label: "Lists", href: LISTS_PATH, hint: "Checklists and how far along each is", group: "Library", tab: false, go: "l", also: ["checklists"], here: at(LISTS_PATH) },
  { id: "notes", label: "Notes", href: "/notes", hint: "Writing", group: "Library", tab: false, go: "n", also: [], here: under("/notes") },
  {
    id: "tags",
    label: "Tags",
    href: TAGS_PATH,
    hint: "Everything by tag",
    group: "Library",
    tab: false,
    // H for hash. # still works where it is a plain key; on layouts that need AltGr for it, it never could.
    go: "h",
    goAlias: "#",
    also: ["labels"],
    here: under(TAGS_PATH),
  },
  { id: "search", label: "Search", href: "/search", hint: "Find any task or note", group: null, tab: false, go: "s", also: ["find"], here: at("/search") },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    hint: "Areas, tags, display and your data",
    group: null,
    tab: false,
    go: ",",
    also: ["account", "areas", "export", "trash", "restore"],
    // Recently deleted is reached from Settings and leads back there, so it counts as part of it.
    here: (p) => under("/settings")(p) || p === "/trash",
  },
];

export function place(id: PlaceId): Place {
  return PLACES.find((p) => p.id === id)!;
}
