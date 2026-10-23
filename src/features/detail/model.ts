import type { AreaColor } from "@/domain/area-color";
import { isStored, repeats, type Area, type AreaId, type Item, type ItemId, type ItemType, type LocalDate, type Schedule, type ShownItem } from "@/domain/item";
import { occurrenceKey, type ItemKey } from "@/domain/item-key";
import type { Rule, RuleEnd } from "@/domain/recurrence";
import type { TagColors, TagName } from "@/domain/tag";
import { addDays, localMinutes, toLocalDate } from "@/lib/dates";
import { describeRule, presetOf, type RepeatChoice, type RepeatPreset } from "./repeat";
import type { ActionResult } from "@/features/today/commands";
import { formatDayHeading, formatDayIn } from "@/features/today/format";
import { formatClock, parseClock, type Clock } from "@/lib/clock";
import type { Created } from "@/features/notes/model";
import type { PlanFor } from "@/features/inbox/model";
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

/** The types an item may switch between in the panel, in menu order. Nothing becomes a note or stops being one. */
export const TYPE_CHOICES = ["task", "event", "checklist"] as const;
export type TypeChoice = (typeof TYPE_CHOICES)[number];

/** A note stays a note, and a subtask stays what it is. */
export function retypable(item: Pick<ShownItem, "type" | "parentId">): boolean {
  return item.type !== "note" && item.parentId === null;
}

/** Which way a change to one occurrence goes: to that occurrence alone, or to the whole series. */
export type Scope = "one" | "all";

/** A time of day as the client sends it: local wall-clock minutes past midnight and a length in minutes. */
export type TimeOfDay = { start: number; length: number };


/**
 * The time two clock fields describe, typed on either clock, or null without
 * a readable start or with an end that cannot be read. An end at or before the
 * start runs past midnight; no end gives the default length.
 */
export function timeFrom(start: string, end: string): TimeOfDay | null {
  const from = parseClock(start);
  if (from === null) return null;
  if (end.trim() === "") return { start: from, length: DEFAULT_MINUTES };
  const to = parseClock(end);
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
  | ({ kind: "series"; skipped: SkippedDate[] } & RuleView)
  | ({ kind: "occurrence"; on: string; skipped: SkippedDate | null } & RuleView);

/** A skipped occurrence of a series: the key that restores it and its date for reading. */
export type SkippedDate = { key: ItemKey; on: string };

function skippedDate(seriesId: ItemId, on: LocalDate, today: LocalDate): SkippedDate {
  return { key: occurrenceKey(seriesId, on), on: formatDayIn(on, today) };
}

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
  /** `id` is the occurrence key until the occurrence is stored, then its stored id, so either can be acted on. */
  item: { id: ItemKey; type: ItemType; title: string; done: boolean; areaId: AreaId | null };
  /** Whether the panel offers Task, Event and Checklist. A note stays a note and a subtask stays a task. */
  retype: boolean;
  /** Null for notes, which never sit in time. */
  when: string | null;
  /** The local date it sits on, null while it waits for a day. */
  day: LocalDate | null;
  /** The user's local date, so the panel can plan for today or tomorrow and say so. */
  today: LocalDate;
  /** The clock time of a timed item on its first day, null for anything without one. */
  time: TimeOfDay | null;
  /** The deadline, and whether the panel may set or clear it. */
  due: { on: LocalDate | null; editable: boolean };
  areas: { id: AreaId; name: string; color: AreaColor | null }[];
  nesting: Nesting;
  repeat: RepeatView;
  /** The stored item linked notes and tags attach to. Notes and tags on any occurrence attach to its series. */
  notesFor: ItemId;
  /** The tags it wears, by name, and every tag the user has, most used first, for suggestions. */
  /** `colors` holds the colour of every coloured tag the user has, by `tagKey`. */
  tags: { on: TagName[]; known: TagName[]; colors: TagColors };
};

/** The writes the sheet can ask for. Server actions in the app, in-memory fakes in the dev harness. */
export type DetailActions = {
  rename: (id: string, title: string, scope?: Scope) => Promise<ActionResult>;
  setDone: (id: string, done: boolean) => Promise<ActionResult>;
  setArea: (id: string, areaId: string | null, scope?: Scope) => Promise<ActionResult>;
  /** Puts it on a day the server works out from "today", "tomorrow" or a date, keeping any time it has. */
  plan: (id: string, when: PlanFor) => Promise<ActionResult>;
  /** Takes it off its day, back to waiting. */
  unplan: (id: string) => Promise<ActionResult>;
  setTime: (id: string, time: TimeOfDay, scope?: Scope) => Promise<ActionResult>;
  /** Sets the deadline to a local date, or clears it with null. */
  setDue: (id: string, on: LocalDate | null) => Promise<ActionResult>;
  /** Changes the type; on anything that repeats, of the series and every occurrence. */
  setType: (id: string, type: TypeChoice) => Promise<ActionResult>;
  /** Leaves it on its day at any time. */
  clearTime: (id: string, scope?: Scope) => Promise<ActionResult>;
  /** Moves the first date of the series the item belongs to. */
  setFirstDay: (id: string, on: LocalDate) => Promise<ActionResult>;
  addSubtask: (parentId: string, title: string) => Promise<ActionResult>;
  promote: (id: string) => Promise<ActionResult>;
  remove: (id: string, scope?: Scope) => Promise<ActionResult>;
  setRepeat: (id: string, choice: RepeatChoice) => Promise<ActionResult>;
  stopRepeating: (id: string) => Promise<ActionResult>;
  /** Brings back a skipped occurrence, named by its occurrence key. */
  restore: (key: string) => Promise<ActionResult>;
  /** Puts a tag on the item, or on its series for an occurrence. */
  addTag: (id: string, name: string) => Promise<ActionResult>;
  removeTag: (id: string, name: string) => Promise<ActionResult>;
  /** Makes a note linked to the item and answers with its id, so the sheet can open it. */
  newLinkedNote: (itemId: string) => Promise<Created>;
};

/**
 * What the When part of the panel lets someone change. A note has none. A
 * series moves by its First day; one occurrence moves on its own only with
 * "This one", and never off its day, since it stands for that date. Anything
 * else can go to any day or back to waiting, and takes a time once it has a day.
 */
export type PlanOptions = { days: boolean; unplan: boolean; time: boolean; firstDay: boolean };

export function planOptions(view: Pick<DetailView, "when" | "day" | "repeat">, scope: Scope): PlanOptions {
  const { repeat } = view;
  if (view.when === null) return { days: false, unplan: false, time: false, firstDay: false };
  if (repeat.kind === "series") return { days: false, unplan: false, time: true, firstDay: true };
  if (repeat.kind === "occurrence") return { days: scope === "one", unplan: false, time: true, firstDay: scope === "all" };
  return { days: true, unplan: view.day !== null, time: view.day !== null, firstDay: false };
}

export function describeWhen(schedule: Schedule, timeZone: string, clock: Clock): string {
  if (schedule.kind === "unscheduled") return "No day yet, in the Inbox";
  if (schedule.kind === "day") return formatDayHeading(schedule.on);
  const startDay = toLocalDate(schedule.start, timeZone);
  const endDay = toLocalDate(schedule.end, timeZone);
  const start = `${formatDayHeading(startDay)}, ${formatClock(schedule.start, timeZone, clock)}`;
  const end = formatClock(schedule.end, timeZone, clock);
  return endDay === startDay ? `${start} to ${end}` : `${start} to ${formatDayHeading(endDay)}, ${end}`;
}

/**
 * Whether a due date can be set or cleared: on a task or checklist that does
 * not repeat. A deadline on every occurrence of a series would be the same date
 * each time, and a note never sits in time.
 */
export function takesDue(item: Pick<ShownItem, "type" | "recurrence">): boolean {
  return (item.type === "task" || item.type === "checklist") && item.recurrence.kind === "none";
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

function repeatView(
  item: ShownItem,
  series: Item | null,
  subtasks: Item[],
  skipped: LocalDate[],
  timeZone: string,
  today: LocalDate,
): RepeatView {
  if (item.type === "note") return { kind: "hidden" };
  const r = item.recurrence;
  if (r.kind === "none") {
    if (item.parentId !== null) return { kind: "unavailable", reason: "A subtask does not repeat on its own." };
    if (subtasks.length > 0) return { kind: "unavailable", reason: "Something with subtasks cannot repeat." };
    return { kind: "off" };
  }
  if (r.kind === "series") {
    const firstOn = firstDay(item.schedule, timeZone)!;
    return {
      kind: "series",
      skipped: skipped.toSorted().map((on) => skippedDate(item.id as ItemId, on, today)),
      ...ruleView(r.rule, firstOn, firstOn, today),
    };
  }
  // An override whose series was deleted is an ordinary item now.
  if (series?.recurrence.kind !== "series") return { kind: "hidden" };
  return {
    kind: "occurrence",
    on: formatDayIn(r.originalOn, today),
    skipped: item.status === "dropped" ? skippedDate(r.seriesId, r.originalOn, today) : null,
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
  clock: Clock;
  /** The user's local date, so a date in another year can say which. */
  today: LocalDate;
  /** The dates a series was skipped on. */
  skipped?: LocalDate[];
  tags?: DetailView["tags"];
}): DetailView {
  const { item, series = null, areas, subtasks, parent, timeZone, clock, today, skipped = [], tags = { on: [], known: [], colors: {} } } = input;
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
    retype: retypable(item),
    when: item.type === "note" ? null : describeWhen(item.schedule, timeZone, clock),
    day: firstDay(item.schedule, timeZone),
    today,
    time: timeOf(item.schedule, timeZone),
    due: { on: item.dueOn, editable: takesDue(item) },
    areas: areas.map((a) => ({ id: a.id, name: a.name, color: a.color })),
    nesting,
    repeat: repeatView(item, series, subtasks, skipped, timeZone, today),
    notesFor: series?.id ?? (isStored(item) ? item.id : item.recurrence.seriesId),
    tags,
  };
}

export function progressLine(subtasks: { done: boolean }[]): string | null {
  if (subtasks.length === 0) return null;
  return `${subtasks.filter((s) => s.done).length} of ${subtasks.length} done`;
}
