import { z } from "zod";
import {
  ITEM_STATUSES,
  ITEM_TYPES,
  idSchema,
  localDateSchema,
  type Area,
  type AreaId,
  type Item,
  type ItemId,
  type ItemPatch,
  type LocalDate,
  type NewItem,
  type Recurrence,
  type Schedule,
} from "@/domain/item";
import { parseRule, serializeRule } from "@/domain/recurrence";

export const ITEM_COLUMNS =
  "id,type,title,body,status,area_id,parent_id,position,start_at,end_at,scheduled_on,due_on,rrule,series_id,original_on,completed_at,created_at,updated_at";
/** Everything but `body`, which is the heaviest column and which no list view draws. Lists read items with `body: null`. */
export const LIST_COLUMNS = ITEM_COLUMNS.replace("body,", "");
export const AREA_COLUMNS = "id,name,position";

const timestampSchema = z.iso.datetime({ offset: true }).transform((s) => new Date(s));
const itemIdSchema = idSchema.transform((s) => s as ItemId);
const areaIdSchema = idSchema.transform((s) => s as AreaId);

const itemRowSchema = z.object({
  id: itemIdSchema,
  type: z.enum(ITEM_TYPES),
  title: z.string(),
  body: z.unknown().transform((v) => v ?? null),
  status: z.enum(ITEM_STATUSES),
  area_id: areaIdSchema.nullable(),
  parent_id: itemIdSchema.nullable(),
  position: z.number(),
  start_at: timestampSchema.nullable(),
  end_at: timestampSchema.nullable(),
  scheduled_on: localDateSchema.nullable(),
  due_on: localDateSchema.nullable(),
  rrule: z.string().nullable(),
  series_id: itemIdSchema.nullable(),
  original_on: localDateSchema.nullable(),
  completed_at: timestampSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

const areaRowSchema = z.object({ id: areaIdSchema, name: z.string(), position: z.number() });

type ScheduleColumns = {
  start_at: string | null;
  end_at: string | null;
  scheduled_on: LocalDate | null;
};

export class InvalidScheduleError extends Error {
  override name = "InvalidScheduleError";
}

export function scheduleFromColumns(cols: {
  start_at: Date | null;
  end_at: Date | null;
  scheduled_on: LocalDate | null;
}): Schedule {
  const { start_at: start, end_at: end, scheduled_on: on } = cols;
  if (start && on) {
    throw new InvalidScheduleError(`Item is both timed (start_at ${start.toISOString()}) and day-only (scheduled_on ${on})`);
  }
  if (start && end) {
    if (end <= start) {
      throw new InvalidScheduleError(`Item ends (${end.toISOString()}) at or before it starts (${start.toISOString()})`);
    }
    return { kind: "timed", start, end };
  }
  if (start || end) throw new InvalidScheduleError("Item has only one of start_at and end_at");
  if (on) return { kind: "day", on };
  return { kind: "unscheduled" };
}

export function scheduleToColumns(schedule: Schedule): ScheduleColumns {
  switch (schedule.kind) {
    case "unscheduled":
      return { start_at: null, end_at: null, scheduled_on: null };
    case "day":
      return { start_at: null, end_at: null, scheduled_on: schedule.on };
    case "timed":
      if (schedule.end <= schedule.start) {
        throw new InvalidScheduleError(
          `Item ends (${schedule.end.toISOString()}) at or before it starts (${schedule.start.toISOString()})`,
        );
      }
      return { start_at: schedule.start.toISOString(), end_at: schedule.end.toISOString(), scheduled_on: null };
  }
}

export class InvalidRecurrenceError extends Error {
  override name = "InvalidRecurrenceError";
}

export function recurrenceFromColumns(cols: RecurrenceColumns): Recurrence {
  const { rrule, series_id: seriesId, original_on: originalOn } = cols;
  if (rrule !== null) {
    if (seriesId !== null || originalOn !== null) throw new InvalidRecurrenceError("Item both repeats and replaces an occurrence");
    const rule = parseRule(rrule);
    if (!rule) throw new InvalidRecurrenceError(`Item has a rule outside the allowlist: ${rrule.slice(0, 80)}`);
    return { kind: "series", rule };
  }
  if (seriesId !== null && originalOn !== null) return { kind: "override", seriesId, originalOn };
  if (seriesId !== null || originalOn !== null) throw new InvalidRecurrenceError("Item has only one of series_id and original_on");
  return { kind: "none" };
}

type RecurrenceColumns = { rrule: string | null; series_id: ItemId | null; original_on: LocalDate | null };

export function recurrenceToColumns(recurrence: Recurrence): RecurrenceColumns {
  switch (recurrence.kind) {
    case "none":
      return { rrule: null, series_id: null, original_on: null };
    case "series":
      return { rrule: serializeRule(recurrence.rule), series_id: null, original_on: null };
    case "override":
      return { rrule: null, series_id: recurrence.seriesId, original_on: recurrence.originalOn };
  }
}

/** Parses an `items` row from the database. Throws on a malformed row or one that breaks the schedule rules. */
export function itemFromRow(raw: unknown): Item {
  const row = itemRowSchema.parse(raw);
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    status: row.status,
    areaId: row.area_id,
    parentId: row.parent_id,
    position: row.position,
    schedule: scheduleFromColumns(row),
    dueOn: row.due_on,
    recurrence: recurrenceFromColumns(row),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function areaFromRow(raw: unknown): Area {
  return areaRowSchema.parse(raw);
}

export function newItemToInsert(input: NewItem) {
  return {
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    area_id: input.areaId ?? null,
    parent_id: input.parentId ?? null,
    ...scheduleToColumns(input.schedule ?? { kind: "unscheduled" }),
    due_on: input.dueOn ?? null,
    ...recurrenceToColumns(input.recurrence ?? { kind: "none" }),
  };
}

/** Builds the column update for a patch. Keys absent from the patch are left out so they stay untouched. */
export function patchToUpdate(patch: ItemPatch, now: Date) {
  return {
    ...(patch.type !== undefined && { type: patch.type }),
    ...(patch.title !== undefined && { title: patch.title }),
    ...(patch.body !== undefined && { body: patch.body }),
    ...(patch.areaId !== undefined && { area_id: patch.areaId }),
    ...(patch.parentId !== undefined && { parent_id: patch.parentId }),
    ...(patch.schedule !== undefined && scheduleToColumns(patch.schedule)),
    ...(patch.dueOn !== undefined && { due_on: patch.dueOn }),
    ...(patch.recurrence !== undefined && recurrenceToColumns(patch.recurrence)),
    ...(patch.position !== undefined && { position: patch.position }),
    ...(patch.status !== undefined && {
      status: patch.status,
      completed_at: patch.status === "done" ? now.toISOString() : null,
    }),
  };
}
