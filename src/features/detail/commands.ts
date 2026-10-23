import { z } from "zod";
import { idSchema, repeats, type AreaId, type Item, type ItemId, type ItemPatch, type LocalDate, type Schedule } from "@/domain/item";
import { parseItemKey, type ParsedItemKey } from "@/domain/item-key";
import { addDays, DATE_RANGE_ERROR, firstShownMinute, instantAt, localMinutes, outOfRange, parseLocalDate, toLocalDate, wallSpanOn } from "@/lib/dates";
import { formatDayHeading } from "@/features/today/format";
import { formatMinutes, type Clock } from "@/lib/clock";
import { materialize, resolveKey } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import type { ActionResult } from "@/features/today/commands";
import { TITLE_MAX } from "@/features/today/model";
import { DAY_MINUTES } from "@/features/score/layout";
import { buildDetail, firstDay, retypable, subtaskPolicy, takesDue, TYPE_CHOICES, type DetailView, type Scope, type TimeOfDay } from "./model";
import { firstOccurrence, repeatSchema, ruleFor } from "./repeat";
import { byName, tagColors } from "@/domain/tag";
import { byUse } from "@/features/tags/model";
import { saveFailure } from "@/lib/quota";

const titleSchema = z.string().trim().min(1).max(TITLE_MAX);
const areaSchema = z.nullable(idSchema);
const scopeSchema = z.enum(["one", "all"]).default("one");
const timeSchema = z.object({
  start: z.number().int().min(0).max(DAY_MINUTES - 1),
  length: z.number().int().min(1).max(DAY_MINUTES),
});

const TITLE_ERROR = `A title needs a few words, up to ${TITLE_MAX} characters.`;
const MISSING = "That item is not here any more.";
const NOT_SAVED = "That change did not save. Try again.";
const AFTER_END = "The end date is before it first happens.";
const NOT_A_SERIES = "That does not repeat.";

const dateError = (raw: unknown) => (outOfRange(raw) ? DATE_RANGE_ERROR : "That date is not one Axiis can use.");

export function parseItemId(raw: unknown): ItemId | null {
  const id = idSchema.safeParse(raw);
  return id.success ? (id.data as ItemId) : null;
}

async function attempt(work: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await work()) ?? { ok: true };
  } catch (error) {
    return { ok: false, error: saveFailure(error, NOT_SAVED) };
  }
}

/** The series a stored item belongs to: itself for a series, its series for an override, null otherwise. */
async function seriesOf(repo: ItemsRepo, item: Item): Promise<Item | null> {
  if (item.recurrence.kind === "series") return item;
  if (item.recurrence.kind === "override") {
    const series = await repo.get(item.recurrence.seriesId);
    return series?.recurrence.kind === "series" ? series : null;
  }
  return null;
}

/**
 * The stored items a change in `scope` lands on, series first. "one" is the
 * item, or the occurrence it names (stored on first touch). "all" is the whole
 * series plus the override the change was made from, so the one in view changes
 * too. Something that does not repeat is its own target either way.
 */
async function targets(repo: ItemsRepo, key: ParsedItemKey, scope: Scope, timeZone: string): Promise<Item[]> {
  if (scope === "one") {
    const item = key.kind === "item" ? await repo.get(key.id) : await materialize(repo, key, timeZone);
    return item ? [item] : [];
  }
  const found = await resolveKey(repo, key, timeZone);
  if (!found) return [];
  if (found.kind === "virtual") return [found.series];
  const series = await seriesOf(repo, found.item);
  return series && series.id !== found.item.id ? [series, found.item] : [found.item];
}

/** Parses the key and scope, finds the targets and applies `patch` to each. */
function saveTo(
  repo: ItemsRepo,
  rawKey: unknown,
  rawScope: unknown,
  timeZone: string,
  patch: ItemPatch,
): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  const scope = scopeSchema.safeParse(rawScope);
  if (!key || !scope.success) return Promise.resolve({ ok: false, error: MISSING });
  return attempt(async () => {
    const items = await targets(repo, key, scope.data, timeZone);
    if (items.length === 0) return { ok: false, error: MISSING };
    for (const item of items) await repo.update(item.id, patch);
  });
}

export async function loadDetail(
  repo: ItemsRepo,
  key: ParsedItemKey,
  now: Date,
  timeZone: string,
  clock: Clock,
): Promise<DetailView | null> {
  const found = await resolveKey(repo, key, timeZone);
  if (!found) return null;
  const item = found.item;
  const policy = subtaskPolicy(item);
  const [areas, subtasks, parent, series, known, overrides] = await Promise.all([
    repo.listAreas(),
    policy.kind === "holds-subtasks" && found.kind === "stored" ? repo.listChildren(found.item.id) : [],
    policy.kind === "is-subtask" ? repo.get(policy.parentId) : null,
    found.kind === "virtual" ? found.series : found.item.recurrence.kind === "override" ? seriesOf(repo, found.item) : null,
    repo.listTags(),
    found.kind === "stored" && found.item.recurrence.kind === "series"
      ? repo.listOverrides("0001-01-01" as LocalDate, "9999-12-31" as LocalDate, found.item.id)
      : [],
  ]);
  const owner = series?.id ?? found.item.id;
  const on = byName((await repo.tagsForItems([owner as ItemId]))[owner] ?? []).map((t) => t.name);
  const today = toLocalDate(now, timeZone);
  const skipped = overrides.flatMap((o) => (o.status === "dropped" && o.recurrence.kind === "override" ? [o.recurrence.originalOn] : []));
  return buildDetail({ item, series, areas, subtasks, parent, timeZone, clock, today, skipped, tags: { on, known: byUse(known), colors: tagColors(known) } });
}

export async function renameItem(
  repo: ItemsRepo,
  rawKey: unknown,
  rawTitle: unknown,
  timeZone: string,
  rawScope?: unknown,
): Promise<ActionResult> {
  const title = titleSchema.safeParse(rawTitle);
  if (!title.success) return { ok: false, error: TITLE_ERROR };
  return saveTo(repo, rawKey, rawScope, timeZone, { title: title.data });
}

export async function setItemArea(
  repo: ItemsRepo,
  rawKey: unknown,
  rawAreaId: unknown,
  timeZone: string,
  rawScope?: unknown,
): Promise<ActionResult> {
  const areaId = areaSchema.safeParse(rawAreaId);
  if (!areaId.success) return { ok: false, error: "That area could not be found." };
  return saveTo(repo, rawKey, rawScope, timeZone, { areaId: areaId.data as AreaId | null });
}

/** The day a stored item sits on: its own, or for an override with no day, the date it stands for. */
function dayOf(item: Item, timeZone: string): LocalDate | null {
  return firstDay(item.schedule, timeZone) ?? (item.recurrence.kind === "override" ? item.recurrence.originalOn : null);
}

/**
 * Gives each target a new schedule on the day it already sits on. With scope
 * "all" that day is the series' first date, so every occurrence without an
 * override follows; the override it was changed from follows too, and other
 * overrides keep their own.
 */
function scheduleOnOwnDay(
  repo: ItemsRepo,
  rawKey: unknown,
  rawScope: unknown,
  timeZone: string,
  build: (on: LocalDate, item: Item) => Schedule | { refused: string },
): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  const scope = scopeSchema.safeParse(rawScope);
  if (!key || !scope.success) return Promise.resolve({ ok: false, error: MISSING });
  return attempt(async () => {
    const items = await targets(repo, key, scope.data, timeZone);
    if (items.length === 0) return { ok: false, error: MISSING };
    if (scope.data === "all" && items[0].recurrence.kind !== "series") return { ok: false, error: NOT_A_SERIES };
    if (items.some((i) => i.type === "note" || dayOf(i, timeZone) === null)) {
      return { ok: false, error: "It needs a day before it can have a time." };
    }
    const schedules = items.map((item) => build(dayOf(item, timeZone)!, item));
    const refusal = schedules.find((s) => "refused" in s);
    if (refusal) return { ok: false, error: refusal.refused };
    for (const [i, item] of items.entries()) await repo.update(item.id, { schedule: schedules[i] as Schedule });
  });
}

/**
 * A timed schedule from a start and an end typed on the wall clock of `on`,
 * so both read back as typed on a day the clocks change. A time the clocks
 * skip is refused rather than quietly moved. A series is stored the same way
 * and expansion keeps that wall-clock start and end on every day it repeats.
 */
function typedOn(on: LocalDate, { start, length }: TimeOfDay, timeZone: string, clock: Clock): Schedule | { refused: string } {
  for (const m of [start, start + length]) {
    const shown = firstShownMinute(on, m, timeZone);
    if (shown !== m) {
      const day = formatDayHeading(addDays(on, Math.floor(m / DAY_MINUTES)));
      return { refused: `${formatMinutes(m, clock)} does not happen on ${day}, when the clocks go forward. Try ${formatMinutes(shown, clock)}.` };
    }
  }
  return { kind: "timed", start: instantAt(on, start, timeZone), end: instantAt(on, start + length, timeZone) };
}

/**
 * Gives an item a time of day on the day it already sits on, for this one or
 * all of them. Only local wall-clock minutes come from the client; the
 * instants are worked out here.
 */
export async function setTime(
  repo: ItemsRepo,
  rawKey: unknown,
  rawTime: unknown,
  timeZone: string,
  rawScope?: unknown,
  /** Only for the refusal of a time the clocks skip, which names it and the time to try instead. */
  clock: Clock = "24",
): Promise<ActionResult> {
  const time = timeSchema.safeParse(rawTime);
  if (!time.success) return { ok: false, error: "That time is not one Axiis can use." };
  return scheduleOnOwnDay(repo, rawKey, rawScope, timeZone, (on) => typedOn(on, time.data, timeZone, clock));
}

/** Takes the time away, leaving the item on its day at any time, for this one or all of them. */
export async function clearTime(repo: ItemsRepo, rawKey: unknown, timeZone: string, rawScope?: unknown): Promise<ActionResult> {
  return scheduleOnOwnDay(repo, rawKey, rawScope, timeZone, (on) => ({ kind: "day", on }));
}

/**
 * Sets a deadline, or clears it with null. Only a date comes from the client.
 * Only a task or checklist that does not repeat takes one; doing it twice
 * writes once.
 */
export async function setDue(repo: ItemsRepo, rawId: unknown, rawOn: unknown): Promise<ActionResult> {
  const id = parseItemId(rawId);
  if (!id) return { ok: false, error: MISSING };
  const on = rawOn === null ? null : parseLocalDate(rawOn);
  if (rawOn !== null && !on) return { ok: false, error: dateError(rawOn) };
  return attempt(async () => {
    const item = await repo.get(id);
    if (!item) return { ok: false, error: MISSING };
    if (!takesDue(item)) return { ok: false, error: "Only a task or checklist that does not repeat has a due date." };
    if (item.dueOn !== on) await repo.update(id, { dueOn: on });
  });
}

const typeSchema = z.enum(TYPE_CHOICES);

/**
 * Makes an item a task, an event or a checklist. Type belongs to the whole of
 * something that repeats, so on an occurrence or override it changes the series
 * and every override, with no "This one". A note and a subtask keep their type,
 * and an event can neither hold subtasks nor be one, as the database requires.
 * Nothing about the schedule changes: an event with no time waits for one.
 */
export async function setType(repo: ItemsRepo, rawKey: unknown, rawType: unknown, timeZone: string): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: MISSING };
  const type = typeSchema.safeParse(rawType);
  if (!type.success) return { ok: false, error: "That type is not one Axiis knows." };
  return attempt(async () => {
    const found = await resolveKey(repo, key, timeZone);
    if (!found) return { ok: false, error: MISSING };
    const series = found.kind === "virtual" ? found.series : await seriesOf(repo, found.item);
    const owner = series ?? (found.kind === "stored" ? found.item : null);
    if (!owner) return { ok: false, error: MISSING };
    if (!retypable(owner)) {
      return { ok: false, error: owner.type === "note" ? "A note stays a note." : "A subtask stays a task." };
    }
    if (type.data === "event" && (await repo.listChildren(owner.id)).length > 0) {
      return { ok: false, error: "Something with subtasks cannot be an event." };
    }
    const overrides = series ? await repo.listOverrides("0001-01-01" as LocalDate, "9999-12-31" as LocalDate, series.id) : [];
    for (const target of [owner, ...overrides]) {
      if (target.type !== type.data) await repo.update(target.id, { type: type.data });
    }
  });
}

/**
 * Moves a series' first date, keeping its start and end on the wall clock
 * as expansion places them (`wallSpanOn`). Only the series changes: every override keeps
 * its own day, the one it was changed from included. Only a date comes from
 * the client.
 */
export async function setFirstDay(repo: ItemsRepo, rawKey: unknown, rawDate: unknown, timeZone: string): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: MISSING };
  const on = parseLocalDate(rawDate);
  if (!on) return { ok: false, error: dateError(rawDate) };
  return attempt(async () => {
    const [series] = await targets(repo, key, "all", timeZone);
    if (!series) return { ok: false, error: MISSING };
    if (series.recurrence.kind !== "series") return { ok: false, error: NOT_A_SERIES };
    const { end } = series.recurrence.rule;
    if (end.kind === "until" && end.on < on) return { ok: false, error: AFTER_END };
    if (series.schedule.kind === "unscheduled") return { ok: false, error: MISSING };
    await repo.update(series.id, { schedule: movedTo(series.schedule, on, timeZone) });
  });
}

/** A day or timed schedule on another date, at the same wall-clock start and end. */
function movedTo(s: Exclude<Schedule, { kind: "unscheduled" }>, on: LocalDate, timeZone: string): Schedule {
  if (s.kind === "day") return { kind: "day", on };
  const was = toLocalDate(s.start, timeZone);
  const [start, end] = [s.start, s.end].map((t) => localMinutes(t, was, timeZone));
  return { kind: "timed", ...wallSpanOn(on, start, end, s.end.getTime() - s.start.getTime(), timeZone) };
}

export async function addSubtask(repo: ItemsRepo, rawParentId: unknown, rawTitle: unknown): Promise<ActionResult> {
  const parentId = parseItemId(rawParentId);
  if (!parentId) return { ok: false, error: MISSING };
  const title = titleSchema.safeParse(rawTitle);
  if (!title.success) return { ok: false, error: TITLE_ERROR };
  return attempt(async () => {
    const parent = await repo.get(parentId);
    if (!parent) return { ok: false, error: MISSING };
    // Turns the database trigger's refusal into a sentence instead of a failed save.
    if (subtaskPolicy(parent).kind !== "holds-subtasks") {
      const error = repeats(parent)
        ? "Something that repeats cannot hold subtasks."
        : "Subtasks go one level deep, under a task or a checklist.";
      return { ok: false, error };
    }
    await repo.create({
      type: "task",
      title: title.data,
      parentId,
      areaId: parent.areaId,
      schedule: { kind: "unscheduled" },
    });
  });
}

/** Lifts a subtask out to the top level, where it waits for a time like any captured task. */
export async function promoteSubtask(repo: ItemsRepo, rawId: unknown): Promise<ActionResult> {
  const id = parseItemId(rawId);
  if (!id) return { ok: false, error: MISSING };
  return attempt(async () => {
    await repo.update(id, { parentId: null });
  });
}

/**
 * Removes an item. One occurrence of a series is skipped rather than deleted,
 * so it stays gone instead of coming back from the series. With scope "all" the
 * series goes, with the occurrence it was deleted from; its other overrides
 * stay as ordinary items. Anything else goes with its subtasks: children first,
 * so a failure part way leaves the parent in place and running it again
 * finishes the job.
 */
export async function deleteItem(repo: ItemsRepo, rawKey: unknown, timeZone: string, rawScope?: unknown): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  const scope = scopeSchema.safeParse(rawScope);
  if (!key || !scope.success) return { ok: false, error: MISSING };
  return attempt(async () => {
    const items = await targets(repo, key, scope.data, timeZone);
    if (items.length === 0) return { ok: false, error: MISSING };
    const [first] = items;
    if (scope.data === "one" && first.recurrence.kind === "override" && (await seriesOf(repo, first))) {
      await repo.update(first.id, { status: "dropped" });
      return;
    }
    for (const item of items) {
      for (const child of await repo.listChildren(item.id)) await repo.softDelete(child.id);
      await repo.softDelete(item.id);
    }
    // Frees room under the item cap. Housekeeping, so a failure never fails the delete.
    await repo.purgeDeleted().catch(() => undefined);
  });
}

/**
 * Brings back a skipped occurrence, named by its occurrence key. The override
 * keeps anything changed on it before the skip and is simply open again. An
 * occurrence that is already back is left as it is, so a retry succeeds; one
 * that was never skipped, or is done, is refused.
 */
export async function restoreOccurrence(repo: ItemsRepo, rawKey: unknown, timeZone: string): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (key?.kind !== "occurrence") return { ok: false, error: MISSING };
  return attempt(async () => {
    const found = await resolveKey(repo, key, timeZone);
    if (!found) return { ok: false, error: MISSING };
    if (found.kind === "virtual" || found.item.status === "done") return { ok: false, error: "That one was not skipped." };
    if (!(await seriesOf(repo, found.item))) return { ok: false, error: MISSING };
    if (found.item.status === "dropped") await repo.update(found.item.id, { status: "open" });
  });
}

const NOT_REPEATABLE ="Only a task, event or checklist with no subtasks can repeat.";

/**
 * Sets how an item repeats, or stops it. On an occurrence this changes the whole
 * series. An item waiting for a time starts repeating from today. An item
 * whose day the rule skips, such as every weekday set on a Saturday, moves to
 * its first occurrence, so it is never left on a day nothing shows. Turning
 * repetition off keeps the overrides as ordinary items and leaves the series as
 * a single item on its first date.
 */
export async function setRepeat(
  repo: ItemsRepo,
  rawKey: unknown,
  rawChoice: unknown,
  now: Date,
  timeZone: string,
): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: MISSING };
  const choice = repeatSchema.safeParse(rawChoice);
  if (!choice.success) {
    const until = (rawChoice as { end?: { on?: unknown } } | null)?.end?.on;
    return { ok: false, error: outOfRange(until) ? DATE_RANGE_ERROR : "That repeat setting is not one Axiis knows." };
  }
  const { preset, end } = choice.data;
  return attempt(async () => {
    const [item] = await targets(repo, key, "all", timeZone);
    if (!item) return { ok: false, error: MISSING };

    if (preset === "none") {
      if (item.recurrence.kind !== "series") return;
      for (const o of await repo.listOverrides("0001-01-01" as LocalDate, "9999-12-31" as LocalDate, item.id)) {
        await repo.update(o.id, { recurrence: { kind: "none" } });
      }
      await repo.update(item.id, { recurrence: { kind: "none" } });
      return;
    }

    if (item.recurrence.kind === "override") return { ok: false, error: MISSING };
    if (item.type === "note" || item.parentId !== null || (await repo.listChildren(item.id)).length > 0) {
      return { ok: false, error: NOT_REPEATABLE };
    }
    const rule = ruleFor(preset, end);
    const schedule = item.schedule.kind === "unscheduled" ? { kind: "day" as const, on: toLocalDate(now, timeZone) } : item.schedule;
    const ownDay = firstDay(schedule, timeZone)!;
    const firstOn = firstOccurrence(rule, ownDay);
    if (end.kind === "until" && end.on < firstOn) return { ok: false, error: AFTER_END };
    await repo.update(item.id, {
      recurrence: { kind: "series", rule },
      ...(firstOn !== ownDay || item.schedule.kind === "unscheduled" ? { schedule: movedTo(schedule, firstOn, timeZone) } : {}),
    });
  });
}

/**
 * Ends a series just before the given occurrence. Later overrides that are not
 * done go with it; done ones stay as a record. From the very first occurrence
 * nothing would be left, so the series is deleted instead.
 */
export async function stopRepeating(repo: ItemsRepo, rawKey: unknown, timeZone: string): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: MISSING };
  return attempt(async () => {
    const found = await resolveKey(repo, key, timeZone);
    if (!found) return { ok: false, error: MISSING };
    const series = found.kind === "virtual" ? found.series : await seriesOf(repo, found.item);
    const r = found.item.recurrence;
    if (!series || series.recurrence.kind !== "series" || (r.kind !== "override" && r.kind !== "occurrence")) {
      return { ok: false, error: "That is not one occurrence of a repeating item." };
    }
    const from = r.originalOn;
    const firstOn = firstDay(series.schedule, timeZone) ?? from;
    for (const o of await repo.listOverrides(from, "9999-12-31" as LocalDate, series.id)) {
      if (o.status !== "done") await repo.softDelete(o.id);
    }
    if (from <= firstOn) {
      await repo.softDelete(series.id);
      return;
    }
    const { rule } = series.recurrence;
    const until = addDays(from, -1);
    if (rule.end.kind === "until" && rule.end.on <= until) return;
    await repo.update(series.id, { recurrence: { kind: "series", rule: { ...rule, end: { kind: "until", on: until } } } });
  });
}
