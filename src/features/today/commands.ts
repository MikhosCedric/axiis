import { z } from "zod";
import type { ItemId, LocalDate, Schedule } from "@/domain/item";
import { PASTE_MAX } from "./capture-paste";
import { parseItemKey } from "@/domain/item-key";
import type { TagName } from "@/domain/tag";
import { dayWords } from "@/features/inbox/model";
import { DEFAULT_MINUTES } from "@/features/score/drop";
import { tagCaptured } from "@/features/tags/commands";
import { instantAt, toLocalDate, wallMinutes } from "@/lib/dates";
import type { WeekStart } from "@/features/week/week-of";
import { materialize } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import { saveFailure } from "@/lib/quota";
import { dayOf, momentAt, parseCapture, passesToday, seriesFor, seriesWords, soonAt, type CaptureArea } from "./capture-syntax";
import { TITLE_MAX } from "./model";

export type ActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "That item could not be found.";
const NOT_SAVED = "That did not save. Your words are still here, so try again.";

const titleSchema = z.string().trim().min(1).max(TITLE_MAX);

/**
 * A capture's result. On success it names the new item, so a screen can open
 * it, and says what capture understood: the title it kept, where it landed or
 * null, the tags that saved and the ones that did not.
 */
export type CaptureResult =
  | {
      ok: true;
      id: ItemId;
      type: "task" | "checklist";
      title: string;
      landed: Landed | null;
      tags: TagName[];
      missed: TagName[];
      /** The due date it took, in words ("tomorrow", "Friday 20 November"). */
      due?: string;
      /** The name of the area it was put in. */
      area?: string;
      /** How many items or lines a pasted block made, when it made more than this one. */
      count?: number;
    }
  | { ok: false; error: string; notOwner?: true };

/**
 * Where a capture was planned: its date, that date in words ("tomorrow"), and
 * the wall-clock minutes past midnight its start and end show, or null. `end`
 * is set only when a length was typed. The screen writes them on its clock.
 */
export type Landed = {
  on: LocalDate;
  day: string;
  time: { start: number; end: number | null } | null;
  /** How it repeats, mid-sentence ("every Tuesday, 10 times"), when the capture made a series; `on` is its first day. */
  repeats?: string;
};

const ENDS_BEFORE = "That repeat would end before it starts, or past 2200. Change its end and try again.";
const TOO_LONG = `Titles can be up to ${TITLE_MAX} characters. Put the rest in a note later.`;

/**
 * Captures an unscheduled, top-level checklist. Its lines are added in the
 * detail panel. Its name is taken as typed: a checklist is not planned at
 * capture, so "Groceries for Sunday" stays a name.
 */
export async function captureChecklist(repo: ItemsRepo, raw: unknown): Promise<CaptureResult> {
  const title = titleSchema.safeParse(raw);
  if (!title.success) return { ok: false, error: TOO_LONG };
  try {
    const item = await repo.create({ type: "checklist", title: title.data, schedule: { kind: "unscheduled" } });
    return { ok: true, id: item.id, type: "checklist", title: title.data, landed: null, tags: [], missed: [] };
  } catch (error) {
    return { ok: false, error: saveFailure(error, NOT_SAVED) };
  }
}

/**
 * Captures a task from a line of text. A day, a time, a length and tags at
 * the line's start or end are read here, on the server, against its own clock
 * and the user's time zone; the client sends only the words. A line that
 * names no day lands on `defaultOn` when one is given (the Month's focused
 * day), else on today when it names a time, else nowhere. A line that repeats
 * ("every tuesday 7:30") is created as a series, on its first matching day.
 */
/**
 * A capture queued on the device: its own id, the moment it was typed (ms since the epoch), and the account whose
 * outbox it sat in. A tab left open across a sign-out and someone else's sign-in still holds the first account's
 * outbox, so the server checks the owner before it stores anything.
 */
export type QueuedEntry = { id: string; at: number; owner?: string };

/** What a queued capture gets when it belongs to another account than the one signed in now. Never shown as an error. */
export const NOT_OWNER: CaptureResult = { ok: false, error: "This capture belongs to another account.", notOwner: true };

/** True when a capture may be stored for this session: typed live (no entry), or queued by the account signed in now. */
export function ownedBySession(entry: QueuedEntry | undefined, sessionOwner: string | null): boolean {
  if (entry === undefined) return true;
  return typeof entry.owner === "string" && sessionOwner !== null && entry.owner === sessionOwner;
}

const DAY_MS = 86_400_000;

/** The moment a queued capture was typed if that is plausible (not in the future, within 30 days); else now. */
export function typedAt(entry: QueuedEntry | undefined, now: Date): Date {
  const at = entry?.at;
  if (typeof at !== "number" || !Number.isFinite(at) || at > now.getTime() || at < now.getTime() - 30 * DAY_MS) return now;
  return new Date(at);
}

/** The entry's id when it is a UUID; anything else is ignored and the server makes its own. */
export function queuedId(entry: QueuedEntry | undefined): ItemId | undefined {
  return entry && z.uuid().safeParse(entry.id).success ? (entry.id as ItemId) : undefined;
}

export async function captureTask(
  repo: ItemsRepo,
  raw: unknown,
  now: Date,
  timeZone: string,
  defaultOn: LocalDate | null = null,
  /** Made on the device when the capture was typed; a resend of the same one stores a single item. */
  clientId?: ItemId,
  /** The first day of the user's week, which "next week" counts from; Monday when not given. */
  weekStart?: WeekStart,
  /** The user's areas, which "@work" is matched against; with none given, an "@name" stays in the title. */
  areas?: readonly CaptureArea[],
): Promise<CaptureResult> {
  const text = titleSchema.safeParse(raw);
  if (!text.success) return { ok: false, error: TOO_LONG };
  const said = parseCapture(text.data, { weekStart, areas });
  const today = toLocalDate(now, timeZone);
  // "in 2 hours" is a day and a time at once, counted from the moment the line was typed.
  const soon = said.soon ? soonAt(said.soon.after, now, timeZone) : null;
  const time = soon && said.soon ? { start: soon.start, length: said.soon.length } : said.time;
  const named = soon ? soon.on : said.day ? dayOf(said.day, today, said.weekStart) : null;
  let on = named ?? defaultOn ?? (time ? today : null);
  // A due date is the detail panel's `dueOn`, and an area its `areaId`: the same fields, written with the item so a resend stores them once.
  const dueOn = said.due ? dayOf(said.due, today, said.weekStart) : null;

  // A repeat is always planned: from the day it names, else the default day, else today; past today when its time has come.
  const series = said.repeat ? seriesFor(said.repeat, on ?? today, today, passesToday(said, momentAt(now, timeZone)), said.weekStart) : null;
  if (said.repeat && !series) return { ok: false, error: ENDS_BEFORE };
  if (series) on = series.first;

  let schedule: Schedule = { kind: "unscheduled" };
  let landed: Landed | null = null;
  if (on && time) {
    const start = instantAt(on, time.start, timeZone);
    const end = instantAt(on, time.start + (time.length ?? DEFAULT_MINUTES), timeZone);
    schedule = { kind: "timed", start, end };
    const shown = { start: wallMinutes(start, timeZone), end: time.length === null ? null : wallMinutes(end, timeZone) };
    landed = { on, day: dayWords(on, today), time: shown };
  } else if (on) {
    schedule = { kind: "day", on };
    landed = { on, day: dayWords(on, today), time: null };
  }
  if (landed && series) landed.repeats = seriesWords(series.rule, series.first, today);

  let id: ItemId;
  try {
    const recurrence = series ? { recurrence: { kind: "series" as const, rule: series.rule } } : {};
    const filed = { ...(dueOn && { dueOn }), ...(said.area && { areaId: said.area.id }) };
    id = (await repo.create({ ...(clientId && { id: clientId }), type: "task", title: said.title, schedule, ...recurrence, ...filed })).id;
  } catch (error) {
    return { ok: false, error: saveFailure(error, NOT_SAVED) };
  }
  const { tags, missed } = await tagCaptured(repo, id, said.tags);
  const told = { ...(dueOn && { due: dayWords(dueOn, today) }), ...(said.area && { area: said.area.name }) };
  return { ok: true, id, type: "task", title: said.title, landed, tags, missed, ...told };
}

const linesSchema = z.array(titleSchema).min(2).max(PASTE_MAX);
const TOO_MANY = `A pasted list can hold up to ${PASTE_MAX} lines, each up to ${TITLE_MAX} characters.`;

/**
 * Captures a pasted block as one checklist: the first line names it and each
 * line after is one of its lines, in order, taken as typed. If a line fails
 * to save, the lines before it are kept and the error says how many.
 */
export async function captureList(repo: ItemsRepo, raw: unknown): Promise<CaptureResult> {
  const lines = linesSchema.safeParse(raw);
  if (!lines.success) return { ok: false, error: TOO_MANY };
  const [title, ...rest] = lines.data;
  let id: ItemId;
  try {
    id = (await repo.create({ type: "checklist", title, schedule: { kind: "unscheduled" } })).id;
  } catch (error) {
    return { ok: false, error: saveFailure(error, NOT_SAVED) };
  }
  let saved = 0;
  try {
    for (const line of rest) {
      await repo.create({ type: "task", title: line, parentId: id, schedule: { kind: "unscheduled" } });
      saved++;
    }
  } catch (error) {
    return { ok: false, error: `“${title}” was made with ${saved} of its ${rest.length} lines. ${saveFailure(error, "The rest did not save.")}` };
  }
  return { ok: true, id, type: "checklist", title, landed: null, tags: [], missed: [], count: rest.length };
}

/**
 * Captures each line of a pasted block as its own task, read the way a typed
 * line is: a day, a time, tags and the rest on each. It stops at the first
 * line that does not save and says how many did. The result is the last
 * item's, with the count.
 */
export async function captureLines(
  repo: ItemsRepo,
  raw: unknown,
  now: Date,
  timeZone: string,
  defaultOn: LocalDate | null = null,
  weekStart?: WeekStart,
  areas?: readonly CaptureArea[],
): Promise<CaptureResult> {
  const lines = linesSchema.safeParse(raw);
  if (!lines.success) return { ok: false, error: TOO_MANY };
  let last: CaptureResult | null = null;
  let saved = 0;
  for (const line of lines.data) {
    const result = await captureTask(repo, line, now, timeZone, defaultOn, undefined, weekStart, areas);
    if (!result.ok) return { ok: false, error: `${saved} of ${lines.data.length} were added. ${result.error}` };
    last = result;
    saved++;
  }
  return last && last.ok ? { ...last, count: saved } : { ok: false, error: NOT_SAVED };
}

/** Marks an item, or one occurrence of a series, done or open again. */
export async function setDone(repo: ItemsRepo, rawKey: unknown, done: boolean, timeZone: string): Promise<ActionResult> {
  const key = parseItemKey(rawKey);
  if (!key) return { ok: false, error: NOT_FOUND };
  try {
    const id = key.kind === "item" ? key.id : (await materialize(repo, key, timeZone))?.id;
    if (!id) return { ok: false, error: NOT_FOUND };
    await repo.update(id, { status: done ? "done" : "open" });
    return { ok: true };
  } catch {
    return { ok: false, error: "That change did not save. Try again." };
  }
}
