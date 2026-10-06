import { z } from "zod";
import type { Rule } from "./recurrence";

export const ITEM_TYPES = ["task", "event", "note", "checklist"] as const;
export const ITEM_STATUSES = ["open", "done", "dropped"] as const;

export type ItemType = (typeof ITEM_TYPES)[number];
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const idSchema = z.uuid();
export type ItemId = string & { readonly __brand: "ItemId" };
export type AreaId = string & { readonly __brand: "AreaId" };

/** A calendar date in the user's own time zone, `YYYY-MM-DD`. */
export type LocalDate = string & { readonly __brand: "LocalDate" };
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((s) => s as LocalDate);

/**
 * Where an item sits in time. The three shapes are exclusive by construction;
 * the database enforces the same rule with check constraints.
 */
export type Schedule =
  | { kind: "unscheduled" }
  | { kind: "day"; on: LocalDate }
  | { kind: "timed"; start: Date; end: Date };

/**
 * How an item takes part in repetition. A series carries the rule, and its own
 * schedule is the first occurrence. An override stands in for one occurrence of
 * a series, named by the local date it replaces. Occurrences are never stored.
 */
export type Recurrence =
  | { kind: "none" }
  | { kind: "series"; rule: Rule }
  | { kind: "override"; seriesId: ItemId; originalOn: LocalDate };

export type Item = {
  id: ItemId;
  type: ItemType;
  title: string;
  body: unknown | null;
  status: ItemStatus;
  areaId: AreaId | null;
  parentId: ItemId | null;
  position: number;
  schedule: Schedule;
  dueOn: LocalDate | null;
  recurrence: Recurrence;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Area = {
  id: AreaId;
  name: string;
  position: number;
};

export type NewItem = {
  type: ItemType;
  title: string;
  body?: unknown | null;
  areaId?: AreaId | null;
  parentId?: ItemId | null;
  schedule?: Schedule;
  dueOn?: LocalDate | null;
  recurrence?: Recurrence;
};

export type ItemPatch = Partial<Omit<NewItem, "type">> & { status?: ItemStatus; position?: number };

/** Half-open UTC range `[from, to)` plus the local date it represents. */
export type DayRange = { date: LocalDate; from: Date; to: Date };

/** Half-open span of days: UTC instants `[from, to)` plus the local dates `[fromDate, toDate)` they cover. */
export type SpanRange = { from: Date; to: Date; fromDate: LocalDate; toDate: LocalDate };

export const MAX_SUBTASK_DEPTH = 2;
