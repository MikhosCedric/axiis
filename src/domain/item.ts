import { z } from "zod";

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
  rrule: string | null;
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
  rrule?: string | null;
};

export type ItemPatch = Partial<Omit<NewItem, "type">> & { status?: ItemStatus; position?: number };

/** Half-open UTC range `[from, to)` plus the local date it represents. */
export type DayRange = { date: LocalDate; from: Date; to: Date };

export const MAX_SUBTASK_DEPTH = 2;
