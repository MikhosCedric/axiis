import type { Clock } from "@/lib/clock";
import { addDays } from "@/lib/dates";
import { deleteKind, moreEntries, type QuickItem } from "@/features/actions/model";
import type { Density, Theme, WeekStartSetting } from "@/components/shell/cookies";
import { WEEK_LENGTH, weekOf, type WeekStart } from "@/features/week/week-of";
import type { ItemType, LocalDate } from "@/domain/item";
import { parseTagName, tagKey, type TagName } from "@/domain/tag";
import { PLACES } from "@/components/shell/places";
import { dayHref } from "@/features/day/nav";
import { tagHref } from "@/features/tags/model";
import type { SearchRow } from "@/features/notes/model";
import { parseCapture, previewWords, type CaptureArea } from "@/features/today/capture-syntax";
import { formatDayIn } from "@/features/today/format";
import { formatMonthHeading, monthHref } from "@/features/month/model";
import { completeDatePhrase, parseDatePhrase, parseMonthPhrase } from "./date-phrase";
import { AREA_PARAM, areaHref } from "@/features/filter/href";
import { fold, matchTier, rank } from "./rank";
import type { Visit } from "./recent";

/** An item the palette can act on: a search result, or the item the screen has selected (already open, so no link). */
export type Target = {
  key: string;
  title: string;
  type: ItemType;
  done: boolean;
  href: string | null;
  /** What the row actions know of it (series, day, subtask), which decides what else can be offered. */
  quick?: QuickItem;
};

/** The days a palette action can plan an item for. "next-week" is the first day of the next week, which the palette works out. */
export type PlanWhen = "today" | "tomorrow" | "next-week";

/** What an action does to its item. Each runs an existing server command; "ask-tag" only starts a tag name. */
export type Act =
  | { do: "open"; href: string }
  | { do: "done"; done: boolean }
  | { do: "plan"; when: PlanWhen }
  | { do: "inbox" }
  | { do: "duplicate"; tomorrow: boolean }
  | { do: "type"; type: "event" | "task" }
  | { do: "delete"; scope: "one" | "all" }
  | { do: "tag"; name: TagName }
  | { do: "ask-tag" };

/** A display switch, as Settings makes it: kept in a cookie on this device. */
export type Setting =
  | { name: "density"; value: Density }
  | { name: "week-start"; value: WeekStartSetting }
  | { name: "theme"; value: Theme }
  | { name: "reminders"; value: boolean };

/** What a command that is about no item does. */
export type Run = { do: "set"; setting: Setting } | { do: "rest" };

export type Command =
  | { kind: "go"; id: string; label: string; href: string; hint?: string; go?: string }
  | { kind: "help"; id: string; label: string; hint: string }
  | { kind: "date"; id: string; label: string; href: string }
  | { kind: "capture"; id: string; label: string; title: string }
  | { kind: "open"; id: string; label: string; detail: string; target: Target }
  | { kind: "act"; id: string; label: string; act: Act }
  | { kind: "run"; id: string; label: string; run: Run };

export type SectionId = "selected" | "recent" | "go" | "areas" | "dates" | "capture" | "find" | "act" | "commands";
export type Section = { id: SectionId; label: string; commands: Command[] };

/** Search runs on the server, so its rows arrive later than the typing that asked for them. */
export type Find =
  | { status: "idle" }
  | { status: "searching"; query: string }
  | { status: "done"; query: string; rows: SearchRow[] }
  | { status: "failed"; query: string };

const FIND_MIN = 2;
export const FIND_MAX = 6;

type Destination = { label: string; href: string | null; hint: string; also: readonly string[]; go?: string | null };

/** Every page, the Help page, then the Guide, which opens a dialog rather than a page. */
const DESTINATIONS: Destination[] = [
  ...PLACES,
  { label: "Help", href: "/help", hint: "Capture words, keys, offline, the app", also: ["manual", "docs", "changelog", "what is new"] },
  { label: "Guide", href: null, hint: "Help and every shortcut", also: ["help", "keyboard shortcuts", "keys"] },
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
 * the item the screen has selected comes first, then the pages visited lately.
 * Empty sections are left out. A page with a G key names it.
 */
export function paletteSections(
  input: string,
  today: LocalDate,
  clock: Clock,
  find: Find,
  selected: Target | null = null,
  recent: readonly Visit[] = [],
  weekStart?: WeekStart,
  areas?: readonly { id: string; name: string }[],
): Section[] {
  const text = input.trim();
  const places = rank(DESTINATIONS, text, (p) => [p.label, ...p.also]);
  const go: Command[] = places.map((p) =>
    p.href === null
      ? { kind: "help", id: "help", label: p.label, hint: p.hint }
      : { kind: "go", id: `go-${p.label.toLowerCase()}`, label: p.label, href: p.href, hint: p.hint, ...(p.go ? { go: p.go } : {}) },
  );
  if (!text) {
    const pick: Section[] = selected
      ? [{ id: "selected", label: "Selected", commands: [{ kind: "open", id: "selected", label: selected.title, detail: "", target: selected }] }]
      : [];
    const lately: Section[] = recent.length
      ? [{ id: "recent", label: "Recent", commands: recent.map((v) => ({ kind: "go", id: `recent-${v.href}`, label: v.title, href: v.href })) }]
      : [];
    return [...pick, ...lately, { id: "go", label: "Go to", commands: go }];
  }

  const tag = text.startsWith("#") ? parseTagName(text) : null;
  if (tag) go.unshift({ kind: "go", id: `go-tag-${tagKey(tag)}`, label: `Go to #${tag}`, href: tagHref(tag) });

  const exact = parseDatePhrase(text, today);
  const completed = completeDatePhrase(text);
  const date = exact ?? (completed ? parseDatePhrase(completed, today) : null);
  const coveredByToday = date === today && places.some((p) => p.href === "/today");
  const month = date ? null : parseMonthPhrase(text, today);
  const dates: Command[] =
    date && !coveredByToday
      ? [{ kind: "date", id: `date-${date}`, label: dateLabel(date, today), href: dayHref(date, today, "grid") }]
      : month
        ? [{ kind: "date", id: `month-${month}`, label: `Go to ${formatMonthHeading(month)}`, href: monthHref(month, today) }]
        : [];

  const q = findQuery(text);
  const rows = find.status === "done" && find.query === q ? find.rows.slice(0, FIND_MAX) : [];
  // An item already named exactly what was typed comes first, so a bare Enter opens it rather than making a second one.
  const same = rows.filter((r) => sameTitle(r.title, text));
  const found: Command[] = [...same, ...rows.filter((r) => !same.includes(r))].map((r) => ({
    kind: "open",
    id: `open-${r.id}`,
    label: r.title,
    detail: r.snippet,
    target: { key: r.id, title: r.title, type: r.type, done: r.done, href: r.href, quick: r.quick },
  }));

  const read = parseCapture(text, { weekStart, areas: areas as readonly CaptureArea[] | undefined });
  const understood = previewWords(read, clock, { today });
  const what = same.length ? "as a new task" : "as a task";
  const label = read.untitled
    ? `Capture “${text}” ${what}. ${understood}`
    : understood
      ? `Capture “${read.title}” ${what}: ${understood}`
      : `Capture “${text}” ${what}`;
  const capture: Command[] = exact || month || tag ? [] : [{ kind: "capture", id: "capture", label, title: text }];

  const findSection: Section = { id: "find", label: "Find", commands: found };
  const sections: Section[] = [
    ...(same.length ? [findSection] : []),
    { id: "go", label: "Go to", commands: go },
    { id: "dates", label: "Dates", commands: dates },
    { id: "capture", label: "Capture", commands: capture },
    ...(same.length ? [] : [findSection]),
  ];
  return sections.filter((s) => s.commands.length > 0);
}

/** True when an item's title is what was typed, ignoring case, spaces and closing punctuation: "Dentist" for "dentist". */
export function sameTitle(title: string, typed: string): boolean {
  const plain = (s: string) => fold(s).replace(/[.!?,;:]+$/, "");
  return plain(title) !== "" && plain(title) === plain(typed);
}

/** True when the sections lead with an item named exactly what was typed. */
export function leadsWithMatch(sections: readonly Section[]): boolean {
  return sections[0]?.id === "find";
}

/**
 * "Show only Work" for each area, and "Show all areas" while one is shown, for what is typed.
 * Only a prefix or a substring counts, so a loose match never crowds the list with areas.
 * `here` is the page the palette was opened on, which the choice narrows.
 */
export function areaSection(input: string, areas: readonly { id: string; name: string }[], here: { pathname: string; query: string }): Section[] {
  const text = input.trim();
  if (!text || areas.length === 0) return [];
  const shown = new URLSearchParams(here.query).get(AREA_PARAM);
  const offers = [
    ...areas.map((a) => ({ id: `area-${a.id}`, label: `Show only ${a.name}`, href: areaHref(here.pathname, here.query, a.id), also: [a.name, "area", "filter"] })),
    ...(shown ? [{ id: "area-all", label: "Show all areas", href: areaHref(here.pathname, here.query, null), also: ["every area", "area", "clear filter"] }] : []),
  ];
  const commands: Command[] = offers
    .flatMap((o) => {
      const tiers = [o.label, ...o.also].map((t) => matchTier(text, t)).filter((t) => t !== null && t < 2) as number[];
      return tiers.length ? [{ o, tier: Math.min(...tiers) }] : [];
    })
    .sort((a, b) => a.tier - b.tier)
    .map(({ o }) => ({ kind: "go", id: o.id, label: o.label, href: o.href, hint: "Area" }));
  return commands.length ? [{ id: "areas", label: "Areas", commands }] : [];
}

type Offer = { label: string; act: Act; also: string[] };

const PLAN_LABEL: Record<PlanWhen, string> = { today: "today", tomorrow: "tomorrow", "next-week": "next week" };

/**
 * What can be done to `target`, filtered by what is typed. Typing `#` and a
 * name offers that tag. A note has no plan and is never done, so it offers
 * Open, a tag, a copy and Delete. What a series or a subtask allows follows
 * the More menu's rules, when the item says what it is.
 */
export function actSections(input: string, target: Target): Section[] {
  const text = input.trim();
  const section = (commands: Command[]): Section[] =>
    commands.length ? [{ id: "act", label: `Actions for “${target.title}”`, commands }] : [];
  if (text.startsWith("#")) {
    const name = parseTagName(text);
    return section(name ? [{ kind: "act", id: "act-tag", label: `Tag #${name}`, act: { do: "tag", name } }] : []);
  }
  const { quick } = target;
  const entries = quick ? moreEntries(quick) : [];
  const planned = target.type !== "note" && quick?.series !== "series";
  const offers: Offer[] = [
    ...(target.href ? [{ label: target.type === "note" ? "Open" : "Open details", act: { do: "open", href: target.href } as Act, also: ["open", "show", "go"] }] : []),
    ...(target.type === "note"
      ? []
      : [
          target.done
            ? { label: "Mark open again", act: { do: "done", done: false } as Act, also: ["undo", "reopen", "not done"] }
            : { label: "Mark done", act: { do: "done", done: true } as Act, also: ["complete", "finish", "tick"] },
        ]),
    ...(planned
      ? (["today", "tomorrow", "next-week"] as const).map((when) => ({
          label: `Plan for ${PLAN_LABEL[when]}`,
          act: { do: "plan", when } as Act,
          also: ["schedule", "move"],
        }))
      : []),
    ...(entries.includes("inbox") ? [{ label: "Move to Inbox", act: { do: "inbox" } as Act, also: ["unplan", "unschedule", "no day"] }] : []),
    ...(quick && entries.includes("duplicate")
      ? [
          target.type !== "note" && !quick.subtask
            ? { label: "Duplicate to tomorrow", act: { do: "duplicate", tomorrow: true } as Act, also: ["copy", "clone"] }
            : { label: "Duplicate", act: { do: "duplicate", tomorrow: false } as Act, also: ["copy", "clone"] },
        ]
      : []),
    ...(entries.includes("make-event") ? [{ label: "Make event", act: { do: "type", type: "event" } as Act, also: ["convert", "type"] }] : []),
    ...(entries.includes("make-task") ? [{ label: "Make task", act: { do: "type", type: "task" } as Act, also: ["convert", "type"] }] : []),
    { label: "Add a tag", act: { do: "ask-tag" }, also: ["label", "#"] },
    ...deleteOffers(target),
  ];
  return section(rank(offers, text, (o) => [o.label, ...o.also]).map((o) => ({ kind: "act", id: `act-${o.label}`, label: o.label, act: o.act })));
}

/** Delete as the row asks it: one time a series happens is skipped or every time deleted; a series' own row takes every time. */
function deleteOffers(target: Target): Offer[] {
  const also = ["remove", "trash"];
  switch (target.quick ? deleteKind(target.quick) : "now") {
    case "now":
      return [{ label: "Delete", act: { do: "delete", scope: "one" }, also }];
    case "ask-occurrence":
      return [
        { label: "Skip on this day", act: { do: "delete", scope: "one" }, also: [...also, "delete"] },
        { label: "Delete every time", act: { do: "delete", scope: "all" }, also },
      ];
    case "ask-series":
      return [{ label: "Delete every time", act: { do: "delete", scope: "all" }, also }];
  }
}

/** What the status line says once an action on `title` has saved. */
export function actedLine(act: Exclude<Act, { do: "open" } | { do: "ask-tag" }>, title: string): string {
  switch (act.do) {
    case "done":
      return act.done ? `“${title}” is done.` : `“${title}” is open again.`;
    case "plan":
      return `“${title}” is planned for ${PLAN_LABEL[act.when]}.`;
    case "inbox":
      return `“${title}” is in the Inbox.`;
    case "duplicate":
      return act.tomorrow ? `“${title}” is copied to tomorrow.` : `“${title}” is copied.`;
    case "type":
      return `“${title}” is ${act.type === "event" ? "an event" : "a task"} now.`;
    case "delete":
      return act.scope === "one" ? `“${title}” is deleted.` : `“${title}” is deleted, every time.`;
    case "tag":
      return `“${title}” is tagged #${act.name}.`;
  }
}

/** The day "next week" plans for: the first day of the week after this one. */
export function nextWeekDay(today: LocalDate, weekStart: WeekStart = 1): LocalDate {
  return addDays(weekOf(today, weekStart)[0], WEEK_LENGTH);
}

/** The day an action plans for, in the form the plan command takes: "today", "tomorrow" or a date. */
export function planDay(when: PlanWhen, today: LocalDate, weekStart: WeekStart = 1): "today" | "tomorrow" | LocalDate {
  return when === "next-week" ? nextWeekDay(today, weekStart) : when;
}

/** What the display switches read now, so the palette offers only the change that is not already made. `reminders` is null outside the desktop app. */
export type DisplayNow = { density: Density; weekStart: WeekStartSetting; theme: Theme; reminders: boolean | null };

type Switch = { id: string; label: string; run: Run; also: string[] };

/**
 * The commands about no item: planning the rest of today for tomorrow, and the display switches (density, first
 * day of the week, theme, and reminders in the desktop app), each offered only while it would change something.
 * Offered once something is typed, and only where it matches.
 */
export function commandSections(input: string, now: DisplayNow): Section[] {
  const text = input.trim();
  if (!text) return [];
  const set = (setting: Setting): Run => ({ do: "set", setting });
  const switches: Switch[] = [
    { id: "rest", label: "Plan the rest of today for tomorrow", run: { do: "rest" }, also: ["left over", "later", "move"] },
    ...(now.density !== "compact" ? [{ id: "density-compact", label: "Density: compact", run: set({ name: "density", value: "compact" }), also: ["tight", "rows", "spacing"] }] : []),
    ...(now.density !== "spacious" ? [{ id: "density-spacious", label: "Density: spacious", run: set({ name: "density", value: "spacious" }), also: ["roomy", "rows", "spacing"] }] : []),
    ...(now.weekStart !== "monday" ? [{ id: "week-monday", label: "Week starts on Monday", run: set({ name: "week-start", value: "monday" }), also: ["first day", "calendar"] }] : []),
    ...(now.weekStart !== "sunday" ? [{ id: "week-sunday", label: "Week starts on Sunday", run: set({ name: "week-start", value: "sunday" }), also: ["first day", "calendar"] }] : []),
    ...(now.theme !== "light" ? [{ id: "theme-light", label: "Theme: light", run: set({ name: "theme", value: "light" }), also: ["appearance", "colours"] }] : []),
    ...(now.theme !== "dark" ? [{ id: "theme-dark", label: "Theme: dark", run: set({ name: "theme", value: "dark" }), also: ["appearance", "night"] }] : []),
    ...(now.theme !== "system" ? [{ id: "theme-system", label: "Theme: follow the system", run: set({ name: "theme", value: "system" }), also: ["appearance", "device", "auto"] }] : []),
    ...(now.reminders === null
      ? []
      : [{ id: "reminders", label: now.reminders ? "Turn reminders off" : "Turn reminders on", run: set({ name: "reminders", value: !now.reminders }), also: ["notifications", "alerts", "desktop"] }]),
  ];
  // Only a prefix or a substring counts, so a loose match never crowds the list.
  const close = (o: Switch) => [o.label, ...o.also].filter((t) => (matchTier(text, t) ?? 2) < 2);
  const commands: Command[] = rank(switches, text, close).map((o) => ({ kind: "run", id: `run-${o.id}`, label: o.label, run: o.run }));
  return commands.length ? [{ id: "commands", label: "Commands", commands }] : [];
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
