import { z } from "zod";
import type { ItemId, Schedule } from "@/domain/item";
import { parseItemKey } from "@/domain/item-key";
import type { TagName } from "@/domain/tag";
import { dayWords } from "@/features/inbox/model";
import { DEFAULT_MINUTES } from "@/features/score/drop";
import { addTag } from "@/features/tags/commands";
import { instantAt, toLocalDate } from "@/lib/dates";
import { materialize } from "@/lib/items/occurrences";
import type { ItemsRepo } from "@/lib/items/repo";
import { dayOf, parseCapture } from "./capture-syntax";
import { formatClock } from "./format";
import { TITLE_MAX } from "./model";

export type ActionResult = { ok: true } | { ok: false; error: string };

const NOT_FOUND = "That item could not be found.";
const NOT_SAVED = "That did not save. Your words are still here, so try again.";

const titleSchema = z.string().trim().min(1).max(TITLE_MAX);

/**
 * A capture's result. On success it names the new item, so a screen can open
 * it, and says what capture understood: the title it kept, where it was
 * planned in words ("tomorrow, 09:00") or null, the tags that saved and the
 * ones that did not.
 */
export type CaptureResult =
  | { ok: true; id: ItemId; type: "task" | "checklist"; title: string; plan: string | null; tags: TagName[]; missed: TagName[] }
  | { ok: false; error: string };

const TOO_LONG = `Titles can be up to ${TITLE_MAX} characters. Put the rest in a note later.`;

export function captureTask(repo: ItemsRepo, raw: unknown, now: Date, timeZone: string): Promise<CaptureResult> {
  return capture(repo, raw, "task", now, timeZone);
}

/** Captures a top-level checklist. Its lines are added in the detail panel. */
export function captureChecklist(repo: ItemsRepo, raw: unknown, now: Date, timeZone: string): Promise<CaptureResult> {
  return capture(repo, raw, "checklist", now, timeZone);
}

/**
 * Captures an item from a line of text. A day, a time, a length and tags at
 * the line's start or end are read here, on the server, against its own clock
 * and the user's time zone; the client sends only the words.
 */
async function capture(repo: ItemsRepo, raw: unknown, type: "task" | "checklist", now: Date, timeZone: string): Promise<CaptureResult> {
  const text = titleSchema.safeParse(raw);
  if (!text.success) return { ok: false, error: TOO_LONG };
  const said = parseCapture(text.data);
  const today = toLocalDate(now, timeZone);
  const on = said.day ? dayOf(said.day, today) : said.time ? today : null;

  let schedule: Schedule = { kind: "unscheduled" };
  let plan: string | null = null;
  if (on && said.time) {
    const start = instantAt(on, said.time.start, timeZone);
    const end = instantAt(on, said.time.start + (said.time.length ?? DEFAULT_MINUTES), timeZone);
    schedule = { kind: "timed", start, end };
    const clock = formatClock(start, timeZone);
    plan = `${dayWords(on, today)}, ${said.time.length === null ? clock : `${clock} to ${formatClock(end, timeZone)}`}`;
  } else if (on) {
    schedule = { kind: "day", on };
    plan = dayWords(on, today);
  }

  let id: ItemId;
  try {
    id = (await repo.create({ type, title: said.title, schedule })).id;
  } catch {
    return { ok: false, error: NOT_SAVED };
  }
  const tags: TagName[] = [];
  const missed: TagName[] = [];
  for (const name of said.tags) {
    ((await addTag(repo, id, name, timeZone)).ok ? tags : missed).push(name);
  }
  return { ok: true, id, type, title: said.title, plan, tags, missed };
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
