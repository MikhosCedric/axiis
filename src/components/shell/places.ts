import type { LocalDate } from "@/domain/item";
import { DUE_PATH } from "@/features/due/model";
import { LISTS_PATH } from "@/features/lists/model";
import { MONTH_PATH } from "@/features/month/model";
import { TAGS_PATH } from "@/features/tags/model";

/** The rail's headings, in the order they stand. */
export const PLACE_GROUPS = ["Plan", "Capture", "Library"] as const;
export type PlaceGroup = (typeof PLACE_GROUPS)[number];

export type PlaceId = "today" | "week" | "month" | "due" | "inbox" | "lists" | "notes" | "tags" | "search" | "settings";

/**
 * Every page a person can go to, for the rail, the phone bar, the palette and the G-then-letter keys.
 * `group` puts a place under a rail heading; Search and Settings have none, because the rail reaches
 * them through its search field and its account menu. `tab` makes it one of the phone's four tabs.
 */
export type Place = {
  id: PlaceId;
  label: string;
  href: string;
  /** What the place holds, in a few plain words: the rail's tooltip, the More sheet's second line, the palette's aside. */
  hint: string;
  group: PlaceGroup | null;
  tab: boolean;
  /** The key after G that goes here. */
  go: string | null;
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
    href: "/today",
    hint: "Your day on the Score",
    group: "Plan",
    tab: true,
    go: "t",
    also: ["score", "day"],
    here: (p, today) => p === "/today" || p === `/day/${today}`,
  },
  { id: "week", label: "Week", href: "/week", hint: "Seven days at a glance", group: "Plan", tab: true, go: "w", also: ["planner"], here: under("/week") },
  {
    id: "month",
    label: "Month",
    href: MONTH_PATH,
    hint: "The whole month at a glance",
    group: "Plan",
    tab: false,
    go: "m",
    also: ["calendar"],
    here: under(MONTH_PATH),
  },
  {
    id: "due",
    label: "Due",
    href: DUE_PATH,
    hint: "Everything with a due date",
    group: "Plan",
    tab: true,
    go: "d",
    also: ["deadlines", "deadline", "overdue"],
    here: at(DUE_PATH),
  },
  {
    id: "inbox",
    label: "Inbox",
    href: "/inbox",
    hint: "Waiting for a day",
    group: "Capture",
    tab: true,
    go: "i",
    also: ["unscheduled", "waiting"],
    here: at("/inbox"),
  },
  { id: "lists", label: "Lists", href: LISTS_PATH, hint: "Checklists", group: "Library", tab: false, go: "l", also: ["checklists"], here: at(LISTS_PATH) },
  { id: "notes", label: "Notes", href: "/notes", hint: "Writing", group: "Library", tab: false, go: "n", also: [], here: under("/notes") },
  { id: "tags", label: "Tags", href: TAGS_PATH, hint: "Everything by tag", group: "Library", tab: false, go: null, also: ["labels"], here: under(TAGS_PATH) },
  { id: "search", label: "Search", href: "/search", hint: "Find any task or note", group: null, tab: false, go: "s", also: ["find"], here: at("/search") },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    hint: "Areas, tags, display and your data",
    group: null,
    tab: false,
    go: ",",
    also: ["account", "areas", "export"],
    here: under("/settings"),
  },
];

export function place(id: PlaceId): Place {
  return PLACES.find((p) => p.id === id)!;
}
