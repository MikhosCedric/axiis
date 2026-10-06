import type { ItemType, LocalDate } from "@/domain/item";
import { parseTagName, tagKey, type TagName } from "@/domain/tag";
import { dayHref } from "@/features/day/nav";
import { LISTS_PATH } from "@/features/lists/model";
import { tagHref, TAGS_PATH } from "@/features/tags/model";
import type { SearchRow } from "@/features/notes/model";
import { parseCapture, previewWords } from "@/features/today/capture-syntax";
import { formatDayIn } from "@/features/today/format";
import { completeDatePhrase, parseDatePhrase } from "./date-phrase";
import { rank } from "./rank";

/** An item the palette can act on: a search result, or the item the screen has selected (already open, so no link). */
export type Target = { key: string; title: string; type: ItemType; done: boolean; href: string | null };

/** What an action does to its item. Each runs an existing server command; "ask-tag" only starts a tag name. */
export type Act =
  | { do: "open"; href: string }
  | { do: "done"; done: boolean }
  | { do: "plan"; when: "today" | "tomorrow" }
  | { do: "tag"; name: TagName }
  | { do: "ask-tag" };

export type Command =
  | { kind: "go"; id: string; label: string; href: string }
  | { kind: "help"; id: string; label: string }
  | { kind: "date"; id: string; label: string; href: string }
  | { kind: "capture"; id: string; label: string; title: string }
  | { kind: "open"; id: string; label: string; detail: string; target: Target }
  | { kind: "act"; id: string; label: string; act: Act };

export type SectionId = "selected" | "go" | "dates" | "capture" | "find" | "act";
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
 * search results once they are back for this very input. With nothing typed,
 * the item the screen has selected comes first. Empty sections are left out.
 */
export function paletteSections(input: string, today: LocalDate, find: Find, selected: Target | null = null): Section[] {
  const text = input.trim();
  const places = rank(PLACES, text, (p) => [p.label, ...p.also]);
  const go: Command[] = places.map((p) =>
    p.href === null
      ? { kind: "help", id: "help", label: p.label }
      : { kind: "go", id: `go-${p.label.toLowerCase()}`, label: p.label, href: p.href },
  );
  if (!text) {
    const pick: Section[] = selected
      ? [{ id: "selected", label: "Selected", commands: [{ kind: "open", id: "selected", label: selected.title, detail: "", target: selected }] }]
      : [];
    return [...pick, { id: "go", label: "Go to", commands: go }];
  }

  const tag = text.startsWith("#") ? parseTagName(text) : null;
  if (tag) go.unshift({ kind: "go", id: `go-tag-${tagKey(tag)}`, label: `Go to #${tag}`, href: tagHref(tag) });

  const exact = parseDatePhrase(text, today);
  const completed = completeDatePhrase(text);
  const date = exact ?? (completed ? parseDatePhrase(completed, today) : null);
  const coveredByToday = date === today && places.some((p) => p.href === "/today");
  const dates: Command[] =
    date && !coveredByToday ? [{ kind: "date", id: `date-${date}`, label: dateLabel(date, today), href: dayHref(date, today, "score") }] : [];

  const read = parseCapture(text);
  const understood = previewWords(read);
  const label = understood ? `Capture “${read.title}” as a task: ${understood}` : `Capture “${text}” as a task`;
  const capture: Command[] = exact || tag ? [] : [{ kind: "capture", id: "capture", label, title: text }];

  const q = findQuery(text);
  const found: Command[] =
    find.status === "done" && find.query === q
      ? find.rows.slice(0, FIND_MAX).map((r) => ({
          kind: "open",
          id: `open-${r.id}`,
          label: r.title,
          detail: r.snippet,
          target: { key: r.id, title: r.title, type: r.type, done: r.done, href: r.href },
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

type Offer = { label: string; act: Act; also: string[] };

/**
 * What can be done to `target`, filtered by what is typed. Typing `#` and a
 * name offers that tag. A note has no plan and is never done, so it offers
 * only Open and a tag.
 */
export function actSections(input: string, target: Target): Section[] {
  const text = input.trim();
  const section = (commands: Command[]): Section[] =>
    commands.length ? [{ id: "act", label: `Actions for “${target.title}”`, commands }] : [];
  if (text.startsWith("#")) {
    const name = parseTagName(text);
    return section(name ? [{ kind: "act", id: "act-tag", label: `Tag #${name}`, act: { do: "tag", name } }] : []);
  }
  const offers: Offer[] = [
    ...(target.href ? [{ label: "Open", act: { do: "open", href: target.href } as Act, also: ["show", "go"] }] : []),
    ...(target.type === "note"
      ? []
      : [
          target.done
            ? { label: "Mark open again", act: { do: "done", done: false } as Act, also: ["undo", "reopen", "not done"] }
            : { label: "Mark done", act: { do: "done", done: true } as Act, also: ["complete", "finish", "tick"] },
          { label: "Plan for today", act: { do: "plan", when: "today" } as Act, also: ["schedule", "move"] },
          { label: "Plan for tomorrow", act: { do: "plan", when: "tomorrow" } as Act, also: ["schedule", "move"] },
        ]),
    { label: "Add a tag", act: { do: "ask-tag" }, also: ["label", "#"] },
  ];
  return section(rank(offers, text, (o) => [o.label, ...o.also]).map((o) => ({ kind: "act", id: `act-${o.label}`, label: o.label, act: o.act })));
}

/** What the status line says once an action on `title` has saved. */
export function actedLine(act: Exclude<Act, { do: "open" } | { do: "ask-tag" }>, title: string): string {
  switch (act.do) {
    case "done":
      return act.done ? `“${title}” is done.` : `“${title}” is open again.`;
    case "plan":
      return `“${title}” is planned for ${act.when}.`;
    case "tag":
      return `“${title}” is tagged #${act.name}.`;
  }
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
