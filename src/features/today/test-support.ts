import type { Area, AreaId, DayRange, Item, ItemId, ItemPatch, NewItem } from "@/domain/item";
import type { ItemsRepo } from "@/lib/items/repo";

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

export function makeItem(over: Partial<Item> = {}): Item {
  const t = new Date("2026-10-06T08:00:00Z");
  return {
    id: uuid() as ItemId,
    type: "task",
    title: "Untitled",
    body: null,
    status: "open",
    areaId: null,
    parentId: null,
    position: 0,
    schedule: { kind: "unscheduled" },
    dueOn: null,
    rrule: null,
    completedAt: null,
    createdAt: t,
    updatedAt: t,
    ...over,
  };
}

/** In-memory ItemsRepo that records calls and applies the day query from docs/data-model.md. */
export function fakeRepo(items: Item[] = [], areas: Area[] = []) {
  const calls: { listForDay: DayRange[]; create: NewItem[]; update: [ItemId, ItemPatch][] } = {
    listForDay: [],
    create: [],
    update: [],
  };
  const repo: ItemsRepo = {
    async listAreas() {
      return areas;
    },
    async listForDay(range) {
      calls.listForDay.push(range);
      return {
        scheduled: items.filter(
          (i) =>
            (i.schedule.kind === "timed" && range.from <= i.schedule.start && i.schedule.start < range.to) ||
            (i.schedule.kind === "day" && i.schedule.on === range.date),
        ),
        unscheduled: items.filter((i) => i.schedule.kind === "unscheduled" && i.parentId === null),
      };
    },
    async listChildren(parentId) {
      return items.filter((i) => i.parentId === parentId);
    },
    async childCounts(parentIds) {
      const counts: Record<string, { total: number; done: number }> = {};
      for (const i of items) {
        if (i.parentId === null || !parentIds.includes(i.parentId)) continue;
        const c = (counts[i.parentId] ??= { total: 0, done: 0 });
        c.total += 1;
        if (i.status === "done") c.done += 1;
      }
      return counts;
    },
    async get(id) {
      return items.find((i) => i.id === id) ?? null;
    },
    async create(input) {
      calls.create.push(input);
      const item = makeItem({ ...input, schedule: input.schedule ?? { kind: "unscheduled" } } as Partial<Item>);
      items.push(item);
      return item;
    },
    async update(id, patch) {
      calls.update.push([id, patch]);
      const item = items.find((i) => i.id === id);
      if (!item) throw new Error("not found");
      Object.assign(item, patch);
      if (patch.status) item.completedAt = patch.status === "done" ? new Date() : null;
      return item;
    },
    async softDelete() {},
  };
  return { repo, calls, items };
}

export const area = (name: string): Area => ({ id: uuid() as AreaId, name, position: 0 });
