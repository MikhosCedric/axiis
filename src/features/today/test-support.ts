import type { Area, AreaId, DayRange, Item, ItemId, ItemPatch, NewItem } from "@/domain/item";
import { sameTag, type Tag, type TagId, type TagName } from "@/domain/tag";
import { INBOX_LIMIT, MAX_SERIES, TAGGED_LIMIT, type ItemsRepo } from "@/lib/items/repo";

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
    recurrence: { kind: "none" },
    completedAt: null,
    createdAt: t,
    updatedAt: t,
    ...over,
  };
}

/** In-memory ItemsRepo that records calls and applies the day query from docs/data-model.md. */
export function fakeRepo(items: Item[] = [], areas: Area[] = []) {
  const calls: { listForDay: DayRange[]; create: NewItem[]; update: [ItemId, ItemPatch][]; addTag: [ItemId, TagName][] } = {
    listForDay: [],
    create: [],
    update: [],
    addTag: [],
  };
  const repo: ItemsRepo = {
    async listAreas() {
      return areas;
    },
    async listForDay(range) {
      calls.listForDay.push(range);
      return {
        scheduled: single().filter(
          (i) =>
            (i.schedule.kind === "timed" && range.from <= i.schedule.start && i.schedule.start < range.to) ||
            (i.schedule.kind === "day" && i.schedule.on === range.date),
        ),
        unscheduled: single().filter((i) => i.schedule.kind === "unscheduled" && i.parentId === null),
      };
    },
    async listRange(range) {
      return single().filter(
        (i) =>
          (i.schedule.kind === "timed" && range.from <= i.schedule.start && i.schedule.start < range.to) ||
          (i.schedule.kind === "day" && range.fromDate <= i.schedule.on && i.schedule.on < range.toDate),
      );
    },
    async listSeries() {
      return items.filter((i) => i.recurrence.kind === "series").slice(0, MAX_SERIES);
    },
    async listInbox() {
      return items
        .filter(
          (i) =>
            i.schedule.kind === "unscheduled" &&
            i.parentId === null &&
            i.recurrence.kind === "none" &&
            i.status === "open" &&
            i.type !== "note",
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, INBOX_LIMIT);
    },
    async listOverrides(fromDate, toDate, seriesId) {
      return items.filter(
        (i) =>
          i.recurrence.kind === "override" &&
          fromDate <= i.recurrence.originalOn &&
          i.recurrence.originalOn < toDate &&
          (seriesId === undefined || i.recurrence.seriesId === seriesId),
      );
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
      const r = input.recurrence;
      if (
        r?.kind === "override" &&
        items.some((i) => i.recurrence.kind === "override" && i.recurrence.seriesId === r.seriesId && i.recurrence.originalOn === r.originalOn)
      ) {
        throw new Error('duplicate key value violates unique constraint "items_series_original"');
      }
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
    async softDelete(id) {
      const at = items.findIndex((i) => i.id === id);
      if (at !== -1) items.splice(at, 1);
    },
    async listTags() {
      return tags.map((t) => ({
        ...t,
        open: itemTags.filter((l) => l.tagId === t.id && items.some((i) => i.id === l.itemId && i.status === "open")).length,
      }));
    },
    async tagsForItems(ids) {
      const byItem: Record<string, Tag[]> = {};
      for (const l of itemTags) {
        const tag = tags.find((t) => t.id === l.tagId);
        if (tag && ids.includes(l.itemId)) (byItem[l.itemId] ??= []).push({ ...tag });
      }
      return byItem;
    },
    async listTagged(tagId) {
      const rank = { open: 0, done: 1, dropped: 2 };
      return items
        .filter((i) => i.status !== "dropped" && itemTags.some((l) => l.itemId === i.id && l.tagId === tagId))
        .sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, TAGGED_LIMIT);
    },
    async addTag(itemId, name) {
      calls.addTag.push([itemId, name]);
      return link(itemId, name);
    },
    async removeTag(itemId, id) {
      drop(itemTags, (l) => l.itemId === itemId && l.tagId === id);
    },
    async renameTag(id, name) {
      const tag = tags.find((t) => t.id === id);
      if (!tag) throw new Error("not found");
      if (tags.some((t) => t.id !== id && sameTag(t.name, name))) {
        throw new Error('duplicate key value violates unique constraint "tags_user_name_ci"');
      }
      tag.name = name;
      return { ...tag };
    },
    async deleteTag(id) {
      drop(tags, (t) => t.id === id);
      drop(itemTags, (l) => l.tagId === id);
    },
  };
  const single = () => items.filter((i) => i.recurrence.kind !== "series");
  const tags: Tag[] = [];
  const itemTags: { itemId: ItemId; tagId: TagId }[] = [];
  function link(itemId: ItemId, name: TagName): Tag {
    let tag = tags.find((t) => sameTag(t.name, name));
    if (!tag) {
      tag = { id: tagId(), name };
      tags.push(tag);
    }
    const id = tag.id;
    if (!itemTags.some((l) => l.itemId === itemId && l.tagId === id)) itemTags.push({ itemId, tagId: id });
    return { ...tag };
  }
  return {
    repo,
    calls,
    items,
    tags,
    itemTags,
    /** Puts tags on an item directly, for arranging a test. */
    tag(itemId: ItemId, ...names: string[]) {
      for (const name of names) link(itemId, name as TagName);
    },
  };
}

/** Removes every match in place, so the arrays a test holds stay live. */
function drop<T>(list: T[], match: (entry: T) => boolean) {
  for (let i = list.length - 1; i >= 0; i--) if (match(list[i])) list.splice(i, 1);
}

let tagSeq = 0;
const tagId = () => `00000000-0000-4000-b000-${String(++tagSeq).padStart(12, "0")}` as TagId;

export const area = (name: string): Area => ({ id: uuid() as AreaId, name, position: 0 });
