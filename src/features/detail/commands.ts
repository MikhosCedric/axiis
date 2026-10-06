import { z } from "zod";
import { idSchema, repeats, type AreaId, type Item, type ItemId, type ItemPatch, type LocalDate, type Schedule } from "@/domain/item";
import { parseItemKey, type ParsedItemKey } from "@/domain/item-key";
import { addDays, instantAt, localMinutes, parseLocalDate, toLocalDate } from "@/lib/dates";
import { materialize, resolveKey } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import type { ActionResult } from "@/features/today/commands";
import { TITLE_MAX } from "@/features/today/model";
import { DAY_MINUTES } from "@/features/score/layout";
import { buildDetail, firstDay, subtaskPolicy, type DetailView, type Scope, type TimeOfDay } from "./model";
import { repeatSchema, ruleFor } from "./repeat";

const titleSchema = z.string().trim().min(1).max(TITLE_MAX);
const areaSchema = idSchema.nullable();
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

export function parseItemId(raw: unknown): ItemId | null {
  const id = idSchema.safeParse(raw);
  return id.success ? (id.data as ItemId) : null;
}

async function attempt(work: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await work()) ?? { ok: true };
  } catch {
    return { ok: false, error: NOT_SAVED };
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

export async function loadDetail(repo: ItemsRepo, key: ParsedItemKey, timeZone: string): Promise<DetailView | null> {
  const found = await resolveKey(repo, key, timeZone);
  if (!found) return null;
  const item = found.item;
  const policy = subtaskPolicy(item);
  const [areas, subtasks, parent, series] = await Promise.all([
    repo.listAreas(),
    policy.kind === "holds-subtasks" && found.kind === "stored" ? repo.listChildren(found.item.id) : [],
    policy.kind === "is-subtask" ? repo.get(policy.parentId) : null,
    found.kind === "virtual" ? found.series : found.item.recurrence.kind === "override" ? seriesOf(repo, found.item) : null,
  ]);
  return buildDetail({ item, series, areas, subtasks, parent, timeZone });
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
  build: (on: LocalDate) => Schedule,
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
    for (const item of items) await repo.update(item.id, { schedule: build(dayOf(item, timeZone)!) });
  });
}

/**
 * A timed schedule at local wall-clock `start` on `on`. The length is real
 * time, as expansion keeps it, so a start the clocks skip never leaves it empty.
 */
function timedAt(on: LocalDate, start: number, lengthMs: number, timeZone: string): Schedule {
  const from = instantAt(on, start, timeZone);
  return { kind: "timed", start: from, end: new Date(from.getTime() + lengthMs) };
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
): Promise<ActionResult> {
  const time = timeSchema.safeParse(rawTime);
  if (!time.success) return { ok: false, error: "That time is not one Axiis can use." };
  const { start, length }: TimeOfDay = time.data;
  return scheduleOnOwnDay(repo, rawKey, rawScope, timeZone, (on) => timedAt(on, start, length * 60_000, timeZone));
}

/** Takes the time away, leaving the item on its day at any time, for this one or all of them. */
export async function clearTime(repo: ItemsRepo, rawKey: unknown, timeZone: string, rawScope?: unknown): Promise<ActionResult> {
  return scheduleOnOwnDay(repo, rawKey, rawScope, timeZone, (on) => ({ kind: "day", on }));
}

/**
 * Moves a series' first date, keeping its time of day on the wall clock and
 * its length in real minutes. Only the series changes: every override keeps
 * its own day, the one it was changed from included. Only a date comes from
 * the client.
 */
export async function setFirstDay(repo: ItemsRepo, rawKey: unknown, rawDate: unknown, timeZone: string): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: MISSING };
  const on = parseLocalDate(rawDate);
  if (!on) return { ok: false, error: "That date is not one Axiis can use." };
  return attempt(async () => {
    const [series] = await targets(repo, key, "all", timeZone);
    if (!series) return { ok: false, error: MISSING };
    if (series.recurrence.kind !== "series") return { ok: false, error: NOT_A_SERIES };
    const { end } = series.recurrence.rule;
    if (end.kind === "until" && end.on < on) return { ok: false, error: AFTER_END };
    const s = series.schedule;
    if (s.kind === "unscheduled") return { ok: false, error: MISSING };
    const schedule: Schedule =
      s.kind === "day"
        ? { kind: "day", on }
        : timedAt(on, localMinutes(s.start, toLocalDate(s.start, timeZone), timeZone), s.end.getTime() - s.start.getTime(), timeZone);
    await repo.update(series.id, { schedule });
  });
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
  });
}

const NOT_REPEATABLE = "Only a task, event or checklist with no subtasks can repeat.";

/**
 * Sets how an item repeats, or stops it. On an occurrence this changes the whole
 * series. An item waiting for a time starts repeating from today. Turning
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
  if (!choice.success) return { ok: false, error: "That repeat setting is not one Axiis knows." };
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
    const today = toLocalDate(now, timeZone);
    const firstOn = firstDay(item.schedule, timeZone) ?? today;
    if (end.kind === "until" && end.on < firstOn) return { ok: false, error: AFTER_END };
    await repo.update(item.id, {
      recurrence: { kind: "series", rule: ruleFor(preset, end) },
      ...(item.schedule.kind === "unscheduled" && { schedule: { kind: "day", on: today } }),
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
