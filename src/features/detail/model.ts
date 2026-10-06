import { isStored, repeats, type Area, type AreaId, type Item, type ItemId, type ItemType, type LocalDate, type Schedule, type ShownItem } from "@/domain/item";
import type { ItemKey } from "@/domain/item-key";
import type { Rule, RuleEnd } from "@/domain/recurrence";
import type { TagName } from "@/domain/tag";
import { addDays, localMinutes, toLocalDate } from "@/lib/dates";
import { describeRule, presetOf, type RepeatChoice, type RepeatPreset } from "./repeat";
import type { ActionResult } from "@/features/today/commands";
import { formatClock, formatDayHeading } from "@/features/today/format";
import type { Created } from "@/features/notes/model";
import { DEFAULT_MINUTES } from "@/features/score/drop";
import { DAY_MINUTES } from "@/features/score/layout";

/**
 * What an item may do with subtasks, mirroring the database trigger: only a
 * top-level task or checklist holds subtasks, and nesting stops at two levels.
 */
export type SubtaskPolicy =
  | { kind: "holds-subtasks" }
  | { kind: "is-subtask"; parentId: ItemId }
  | { kind: "no-subtasks" };

export function subtaskPolicy(item: Pick<ShownItem, "type" | "parentId" | "recurrence">): SubtaskPolicy {
  if (item.parentId !== null) return { kind: "is-subtask", parentId: item.parentId };
  if (repeats(item)) return { kind: "no-subtasks" };
  if (item.type === "task" || item.type === "checklist") return { kind: "holds-subtasks" };
  return { kind: "no-subtasks" };
}

/** Which way a change to one occurrence goes: to that occurrence alone, or to the whole series. */
export type Scope = "one" | "all";

/** A time of day as the client sends it: local wall-clock minutes past midnight and a length in minutes. */
export type TimeOfDay = { start: number; length: number };


/** `HH:MM` for minutes past midnight, wrapping past the end of the day. */
export function clockOf(minutes: number): string {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes past midnight for a 24-hour clock typed loosely ("14:30", "14.30", "1430", "930", "9"), or null. */
export function minutesOf(clock: string): number | null {
  const m = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(clock.trim());
  if (!m) return null;
  const [hours, minutes] = [Number(m[1]), Number(m[2] ?? 0)];
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/**
 * The time two clock fields describe, or null without a readable start or
 * with an end that cannot be read. An end at or before the start runs past
 * midnight; no end gives the default length.
 */
export function timeFrom(start: string, end: string): TimeOfDay | null {
  const from = minutesOf(start);
  if (from === null) return null;
  if (end.trim() === "") return { start: from, length: DEFAULT_MINUTES };
  const to = minutesOf(end);
  return to === null ? null : { start: from, length: (to - from + DAY_MINUTES) % DAY_MINUTES || DAY_MINUTES };
}

/**
 * How the item takes part in repetition, as the sheet shows it. Only a top-level
 * task, event or checklist with no subtasks may start repeating.
 */
export type RepeatView =
  | { kind: "hidden" }
  | { kind: "unavailable"; reason: string }
  | { kind: "off" }
  | ({ kind: "series" } & RuleView)
  | ({ kind: "occurrence"; on: string } & RuleView);

/** A series' rule as the sheet edits it. `preset` is null for a rule the menu cannot make. */
export type RuleView = {
  preset: RepeatPreset | null;
  end: RuleEnd;
  summary: string;
  /** The series' first date. */
  firstOn: LocalDate;
  /** Where the end date starts when someone first picks "On a date". */
  defaultUntil: LocalDate;
};

function ruleView(rule: Rule, firstOn: LocalDate, shownOn: LocalDate, today: LocalDate): RuleView {
  return {
    preset: presetOf(rule),
    end: rule.end,
    summary: describeRule(rule, firstOn, today),
    firstOn,
    defaultUntil: addDays(shownOn, 28),
  };
}

export type DetailSubtask = { id: ItemId; title: string; done: boolean };

/** How the item relates to others. Only a parent carries subtasks, so a subtask list on anything else cannot be built. */
export type Nesting =
  | { kind: "holds-subtasks"; subtasks: DetailSubtask[] }
  | { kind: "is-subtask"; parent: { id: ItemId; title: string } | null }
  | { kind: "no-subtasks" };

/** Everything the detail sheet draws, already formatted for the user's zone and safe to send to the client. */
export type DetailView = {
  /** `id` is the key the sheet was opened with, so an occurrence that is not stored yet can still be acted on. */
  item: { id: ItemKey; type: ItemType; title: string; done: boolean; areaId: AreaId | null };
  /** Null for notes, which never sit in time. */
  when: string | null;
  /** The clock time of a timed item on its first day, null for anything without one. */
  time: TimeOfDay | null;
  due: string | null;
  areas: { id: AreaId; name: string }[];
  nesting: Nesting;
  repeat: RepeatView;
  /** The stored item linked notes and tags attach to. Notes and tags on any occurrence attach to its series. */
  notesFor: ItemId;
  /** The tags it wears, by name, and every tag the user has, most used first, for suggestions. */
  tags: { on: TagName[]; known: TagName[] };
};

/** The writes the sheet can ask for. Server actions in the app, in-memory fakes in the dev harness. */
export type DetailActions = {
  rename: (id: string, title: string, scope?: Scope) => Promise<ActionResult>;
  setDone: (id: string, done: boolean) => Promise<ActionResult>;
  setArea: (id: string, areaId: string | null, scope?: Scope) => Promise<ActionResult>;
  setTime: (id: string, time: TimeOfDay, scope?: Scope) => Promise<ActionResult>;
  /** Leaves it on its day at any time. */
  clearTime: (id: string, scope?: Scope) => Promise<ActionResult>;
  /** Moves the first date of the series the item belongs to. */
  setFirstDay: (id: string, on: LocalDate) => Promise<ActionResult>;
  addSubtask: (parentId: string, title: string) => Promise<ActionResult>;
  promote: (id: string) => Promise<ActionResult>;
  remove: (id: string, scope?: Scope) => Promise<ActionResult>;
  setRepeat: (id: string, choice: RepeatChoice) => Promise<ActionResult>;
  stopRepeating: (id: string) => Promise<ActionResult>;
  /** Puts a tag on the item, or on its series for an occurrence. */
  addTag: (id: string, name: string) => Promise<ActionResult>;
  removeTag: (id: string, name: string) => Promise<ActionResult>;
  /** Makes a note linked to the item and answers with its id, so the sheet can open it. */
  newLinkedNote: (itemId: string) => Promise<Created>;
};

export function describeWhen(schedule: Schedule, timeZone: string): string {
  if (schedule.kind === "unscheduled") return "Waiting for a time";
  if (schedule.kind === "day") return formatDayHeading(schedule.on);
  const startDay = toLocalDate(schedule.start, timeZone);
  const endDay = toLocalDate(schedule.end, timeZone);
  const start = `${formatDayHeading(startDay)}, ${formatClock(schedule.start, timeZone)}`;
  const end = formatClock(schedule.end, timeZone);
  return endDay === startDay ? `${start} to ${end}` : `${start} to ${formatDayHeading(endDay)}, ${end}`;
}

export function describeDue(dueOn: LocalDate | null): string | null {
  return dueOn === null ? null : `Due ${formatDayHeading(dueOn)}`;
}

export function firstDay(schedule: Schedule, timeZone: string): LocalDate | null {
  if (schedule.kind === "day") return schedule.on;
  if (schedule.kind === "timed") return toLocalDate(schedule.start, timeZone);
  return null;
}

function timeOf(schedule: Schedule, timeZone: string): TimeOfDay | null {
  if (schedule.kind !== "timed") return null;
  const on = toLocalDate(schedule.start, timeZone);
  const start = localMinutes(schedule.start, on, timeZone);
  return { start, length: localMinutes(schedule.end, on, timeZone) - start };
}

function repeatView(item: ShownItem, series: Item | null, subtasks: Item[], timeZone: string, today: LocalDate): RepeatView {
  if (item.type === "note") return { kind: "hidden" };
  const r = item.recurrence;
  if (r.kind === "none") {
    if (item.parentId !== null) return { kind: "unavailable", reason: "A subtask does not repeat on its own." };
    if (subtasks.length > 0) return { kind: "unavailable", reason: "Something with subtasks cannot repeat." };
    return { kind: "off" };
  }
  if (r.kind === "series") {
    const firstOn = firstDay(item.schedule, timeZone)!;
    return { kind: "series", ...ruleView(r.rule, firstOn, firstOn, today) };
  }
  // An override whose series was deleted is an ordinary item now.
  if (series?.recurrence.kind !== "series") return { kind: "hidden" };
  return {
    kind: "occurrence",
    on: formatDayHeading(r.originalOn),
    ...ruleView(series.recurrence.rule, firstDay(series.schedule, timeZone)!, r.originalOn, today),
  };
}

export function buildDetail(input: {
  item: ShownItem;
  /** The series an occurrence or override belongs to, when it is still there. */
  series?: Item | null;
  areas: Area[];
  subtasks: Item[];
  parent: Item | null;
  timeZone: string;
  /** The user's local date, so a date in another year can say which. */
  today: LocalDate;
  tags?: DetailView["tags"];
}): DetailView {
  const { item, series = null, areas, subtasks, parent, timeZone, today, tags = { on: [], known: [] } } = input;
  const policy = subtaskPolicy(item);
  const nesting: Nesting =
    policy.kind === "holds-subtasks"
      ? {
          kind: "holds-subtasks",
          subtasks: subtasks.map((s) => ({ id: s.id, title: s.title, done: s.status === "done" })),
        }
      : policy.kind === "is-subtask"
        ? { kind: "is-subtask", parent: parent && { id: parent.id, title: parent.title } }
        : { kind: "no-subtasks" };
  return {
    item: { id: item.id, type: item.type, title: item.title, done: item.status === "done", areaId: item.areaId },
    when: item.type === "note" ? null : describeWhen(item.schedule, timeZone),
    time: timeOf(item.schedule, timeZone),
    due: describeDue(item.dueOn),
    areas: areas.map((a) => ({ id: a.id, name: a.name })),
    nesting,
    repeat: repeatView(item, series, subtasks, timeZone, today),
    notesFor: series?.id ?? (isStored(item) ? item.id : item.recurrence.seriesId),
    tags,
  };
}

export function progressLine(subtasks: { done: boolean }[]): string | null {
  if (subtasks.length === 0) return null;
  return `${subtasks.filter((s) => s.done).length} of ${subtasks.length} done`;
}
