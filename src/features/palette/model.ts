import type { ItemType, LocalDate } from "@/domain/item";
import { parseTagName, tagKey } from "@/domain/tag";
import { dayHref } from "@/features/day/nav";
import { LISTS_PATH } from "@/features/lists/model";
import { tagHref, TAGS_PATH } from "@/features/tags/model";
import type { SearchRow } from "@/features/notes/model";
import { formatDayIn } from "@/features/today/format";
import { completeDatePhrase, parseDatePhrase } from "./date-phrase";
import { rank } from "./rank";

export type Command =
  | { kind: "go"; id: string; label: string; href: string }
  | { kind: "help"; id: string; label: string }
  | { kind: "date"; id: string; label: string; href: string }
  | { kind: "capture"; id: string; label: string; title: string }
  | { kind: "open"; id: string; label: string; detail: string; type: ItemType; done: boolean; href: string };

export type SectionId = "go" | "dates" | "capture" | "find";
export type Section = { id: SectionId; label: string; commands: Command[] };

/** Search runs on the server, so its rows arrive later than the typing that asked for them. */
export type Find =
  | { status: "idle" }
  | { status: "searching"; query: string }
  | { status: "done"; query: string; rows: SearchRow[] }
  | { status: "failed"; query: string };

export const FIND_MIN = 2;
export const FIND_MAX = 6;

type Place = { label: string; href: string | null; also: string[] };

const PLACES: Place[] = [
  { label: "Today", href: "/today", also: ["score", "day"] },
  { label: "Week", href: "/week", also: ["planner"] },
  { label: "Inbox", href: "/inbox", also: ["unscheduled", "waiting"] },
  { label: "Lists", href: LISTS_PATH, also: ["checklists"] },
  { label: "Notes", href: "/notes", also: [] },
  { label: "Tags", href: TAGS_PATH, also: ["labels"] },
  { label: "Search", href: "/search", also: ["find"] },
  { label: "Settings", href: "/settings", also: ["account", "areas", "export"] },
  { label: "Keyboard shortcuts", href: null, also: ["help", "keys"] },
];

/** The query search should run for this input, or null when it is too short to be worth it. */
export function findQuery(input: string): string | null {
  const q = input.trim().replace(/\s+/g, " ");
  return q.length >= FIND_MIN ? q : null;
}

function dateLabel(date: LocalDate, today: LocalDate): string {
  return `Go to ${formatDayIn(date, today)}`;
}

/**
 * What the palette offers for `input`, in order: pages, a date, capture, then
 * search results once they are back for this very input. Empty sections are
 * left out.
 */
export function paletteSections(input: string, today: LocalDate, find: Find): Section[] {
  const text = input.trim();
  const places = rank(PLACES, text, (p) => [p.label, ...p.also]);
  const go: Command[] = places.map((p) =>
    p.href === null
      ? { kind: "help", id: "help", label: p.label }
      : { kind: "go", id: `go-${p.label.toLowerCase()}`, label: p.label, href: p.href },
  );
  if (!text) return [{ id: "go", label: "Go to", commands: go }];

  const tag = text.startsWith("#") ? parseTagName(text) : null;
  if (tag) go.unshift({ kind: "go", id: `go-tag-${tagKey(tag)}`, label: `Go to #${tag}`, href: tagHref(tag) });

  const exact = parseDatePhrase(text, today);
  const completed = completeDatePhrase(text);
  const date = exact ?? (completed ? parseDatePhrase(completed, today) : null);
  const coveredByToday = date === today && places.some((p) => p.href === "/today");
  const dates: Command[] =
    date && !coveredByToday ? [{ kind: "date", id: `date-${date}`, label: dateLabel(date, today), href: dayHref(date, today, "score") }] : [];

  const capture: Command[] = exact || tag ? [] : [{ kind: "capture", id: "capture", label: `Capture “${text}” as a task`, title: text }];

  const q = findQuery(text);
  const found: Command[] =
    find.status === "done" && find.query === q
      ? find.rows.slice(0, FIND_MAX).map((r) => ({
          kind: "open",
          id: `open-${r.id}`,
          label: r.title,
          detail: r.snippet,
          type: r.type,
          done: r.done,
          href: r.href,
        }))
      : [];

  const sections: Section[] = [
    { id: "go", label: "Go to", commands: go },
    { id: "dates", label: "Dates", commands: dates },
    { id: "capture", label: "Capture", commands: capture },
    { id: "find", label: "Find", commands: found },
  ];
  return sections.filter((s) => s.commands.length > 0);
}

/** A line for the status area under the list, or null when there is nothing to say. */
export function findStatus(input: string, find: Find): string | null {
  const q = findQuery(input);
  if (!q) return null;
  if (find.status === "searching" && find.query === q) return "Searching";
  if (find.status === "failed" && find.query === q) return "Search did not answer. Try again in a moment.";
  if (find.status === "done" && find.query === q && find.rows.length === 0) return "No items or notes match.";
  return null;
}
