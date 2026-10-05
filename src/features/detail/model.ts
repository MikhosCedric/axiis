import type { Area, AreaId, Item, ItemId, ItemType, LocalDate, Schedule } from "@/domain/item";
import { toLocalDate } from "@/lib/dates";
import { formatClock, formatDayHeading } from "@/features/today/format";

/**
 * What an item may do with subtasks, mirroring the database trigger: only a
 * top-level task or checklist holds subtasks, and nesting stops at two levels.
 */
export type SubtaskPolicy =
  | { kind: "holds-subtasks" }
  | { kind: "is-subtask"; parentId: ItemId }
  | { kind: "no-subtasks" };

export function subtaskPolicy(item: Pick<Item, "type" | "parentId">): SubtaskPolicy {
  if (item.parentId !== null) return { kind: "is-subtask", parentId: item.parentId };
  if (item.type === "task" || item.type === "checklist") return { kind: "holds-subtasks" };
  return { kind: "no-subtasks" };
}

export type DetailSubtask = { id: ItemId; title: string; done: boolean };

/** How the item relates to others. Only a parent carries subtasks, so a subtask list on anything else cannot be built. */
export type Nesting =
  | { kind: "holds-subtasks"; subtasks: DetailSubtask[] }
  | { kind: "is-subtask"; parent: { id: ItemId; title: string } | null }
  | { kind: "no-subtasks" };

/** Everything the detail sheet draws, already formatted for the user's zone and safe to send to the client. */
export type DetailView = {
  item: { id: ItemId; type: ItemType; title: string; done: boolean; areaId: AreaId | null };
  /** Null for notes, which never sit in time. */
  when: string | null;
  due: string | null;
  areas: { id: AreaId; name: string }[];
  nesting: Nesting;
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

export function buildDetail(input: {
  item: Item;
  areas: Area[];
  subtasks: Item[];
  parent: Item | null;
  timeZone: string;
}): DetailView {
  const { item, areas, subtasks, parent, timeZone } = input;
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
    due: describeDue(item.dueOn),
    areas: areas.map((a) => ({ id: a.id, name: a.name })),
    nesting,
  };
}

export function progressLine(subtasks: { done: boolean }[]): string | null {
  if (subtasks.length === 0) return null;
  return `${subtasks.filter((s) => s.done).length} of ${subtasks.length} done`;
}
