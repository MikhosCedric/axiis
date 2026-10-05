import { z } from "zod";
import { idSchema, type Area, type ItemId, type LocalDate } from "@/domain/item";
import { dayRangeFor, toLocalDate } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";
import { buildToday, type TodayView } from "./model";

export type ActionResult = { ok: true } | { ok: false; error: string };

import { TITLE_MAX } from "./model";
const titleSchema = z.string().trim().min(1).max(TITLE_MAX);

export async function captureTask(repo: ItemsRepo, raw: unknown): Promise<ActionResult> {
  const title = titleSchema.safeParse(raw);
  if (!title.success) {
    return { ok: false, error: `Titles can be up to ${TITLE_MAX} characters. Put the rest in a note later.` };
  }
  try {
    await repo.create({ type: "task", title: title.data, schedule: { kind: "unscheduled" } });
    return { ok: true };
  } catch {
    return { ok: false, error: "That did not save. Your words are still here, so try again." };
  }
}

export async function setDone(repo: ItemsRepo, rawId: unknown, done: boolean): Promise<ActionResult> {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { ok: false, error: "That item could not be found." };
  try {
    await repo.update(id.data as ItemId, { status: done ? "done" : "open" });
    return { ok: true };
  } catch {
    return { ok: false, error: "That change did not save. Try again." };
  }
}

export type Today = { timeZone: string; date: LocalDate; areas: Area[]; view: TodayView };

export async function loadToday(repo: ItemsRepo, now: Date, timeZone: string): Promise<Today> {
  const date = toLocalDate(now, timeZone);
  const range = dayRangeFor(date, timeZone);
  const [areas, items] = await Promise.all([repo.listAreas(), repo.listForDay(range)]);
  return { timeZone, date, areas, view: buildToday(items, range, now) };
}
