import type { Area, AreaId, DayRange, Item, ItemId, ItemPatch, NewItem } from "@/domain/item";
import { sameTag, type Tag, type TagId, type TagName } from "@/domain/tag";
import {
  BEHIND_LIMIT,
  DUE_LIMIT,
  INBOX_LIMIT,
  LISTS_LIMIT,
  MAX_SERIES,
  RANGE_LIMIT,
  TAGGED_LIMIT,
  WAITING_LIMIT,
  type ItemsRepo,
} from "@/lib/items/repo";

let seq = 0;
/** Status order where open comes first, as the database's enum declares it. */
const RANK = { open: 0, done: 1, dropped: 2 } as const;
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
  const calls: {
    listForDay: DayRange[];
    create: NewItem[];
    update: [ItemId, ItemPatch][];
    addTags: [ItemId, TagName[]][];
    /** Reads of every tag with its open count, which grow with the account. */
    listTags: number;
    purgeDeleted: number;
  } = {
    listForDay: [],
    create: [],
    update: [],
    addTags: [],
    listTags: 0,
    purgeDeleted: 0,
  };
  const repo: ItemsRepo = {
    async listAreas() {
      return areas;
    },
    async hasAnyItem() {
      return items.length > 0 || deleted > 0;
    },
    async listForDay(range) {
      calls.listForDay.push(range);
      return {
        scheduled: single().filter(
          (i) =>
            (i.schedule.kind === "timed" && range.from <= i.schedule.start && i.schedule.start < range.to) ||
            (i.schedule.kind === "day" && i.schedule.on === range.date),
        ),
        unscheduled: single()
          .filter(
            (i) =>
              i.schedule.kind === "unscheduled" &&
              i.parentId === null &&
              i.type !== "note" &&
              (i.status === "open" ||
                (i.status === "done" && i.completedAt !== null && range.from <= i.completedAt && i.completedAt < range.to)),
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, WAITING_LIMIT),
      };
    },
    async openCountByArea(range) {
      const counts: Record<string, number> = {};
      for (const i of single()) {
        const s = i.schedule;
        const onDay =
          (s.kind === "timed" && range.from <= s.start && s.start < range.to) ||
          (s.kind === "day" && s.on === range.date) ||
          (s.kind === "unscheduled" && i.parentId === null);
        if (onDay && i.status === "open" && i.type !== "note" && i.areaId !== null) counts[i.areaId] = (counts[i.areaId] ?? 0) + 1;
      }
      return counts;
    },
    async listRange(range) {
      return single()
        .filter(
          (i) =>
            (i.schedule.kind === "timed" && range.from <= i.schedule.start && i.schedule.start < range.to) ||
            (i.schedule.kind === "day" && range.fromDate <= i.schedule.on && i.schedule.on < range.toDate),
        )
        .slice(0, RANGE_LIMIT);
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
    async listChecklists() {
      return items
        .filter((i) => i.type === "checklist" && i.parentId === null && i.recurrence.kind !== "override" && i.status !== "dropped")
        .sort((a, b) => RANK[a.status] - RANK[b.status] || b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, LISTS_LIMIT);
    },
    async listDue(doneSince) {
      return items
        .filter(
          (i) =>
            i.dueOn !== null &&
            i.parentId === null &&
            i.type !== "note" &&
            i.recurrence.kind === "none" &&
            (i.status === "open" || (i.status === "done" && i.completedAt !== null && i.completedAt >= doneSince)),
        )
        .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : a.dueOn! > b.dueOn! ? 1 : a.createdAt.getTime() - b.createdAt.getTime()))
        .slice(0, DUE_LIMIT);
    },
    async listDueIn(fromDate, toDate) {
      return single()
        .filter((i) => i.dueOn !== null && fromDate <= i.dueOn && i.dueOn < toDate && i.type !== "note" && i.status !== "dropped")
        .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : a.dueOn! > b.dueOn! ? 1 : a.createdAt.getTime() - b.createdAt.getTime()))
        .slice(0, RANGE_LIMIT);
    },
    async listBehind(range) {
      const startOf = (i: Item) => (i.schedule.kind === "timed" ? i.schedule.start.getTime() : i.schedule.kind === "day" ? Date.parse(`${i.schedule.on}T00:00:00Z`) : 0);
      return items
        .filter(
          (i) =>
            i.status === "open" &&
            i.parentId === null &&
            i.type !== "note" &&
            i.recurrence.kind === "none" &&
            ((i.schedule.kind === "timed" && i.schedule.start < range.from) || (i.schedule.kind === "day" && i.schedule.on < range.date)),
        )
        .sort((a, b) => startOf(a) - startOf(b))
        .slice(0, BEHIND_LIMIT);
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
      if (at !== -1) {
        items.splice(at, 1);
        deleted += 1;
      }
    },
    async purgeDeleted() {
      calls.purgeDeleted += 1;
    },
    async listTags() {
      calls.listTags += 1;
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
      return items
        .filter((i) => i.status !== "dropped" && itemTags.some((l) => l.itemId === i.id && l.tagId === tagId))
        .sort((a, b) => RANK[a.status] - RANK[b.status] || b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, TAGGED_LIMIT);
    },
    async listTagNames() {
      return tags.map((t) => ({ ...t }));
    },
    async addTags(itemId, names) {
      calls.addTags.push([itemId, [...names]]);
      const distinct = names.filter((n, i) => names.findIndex((m) => sameTag(m, n)) === i);
      return distinct.map((name) => link(itemId, name));
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
  // Soft-deleted rows leave `items`, but the database keeps them.
  let deleted = 0;
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

/** Tags stored items by title, for harness fixtures whose ids are made fresh on each load. */
export function tagByTitle<F extends ReturnType<typeof fakeRepo>>(fake: F, byTitle: Record<string, string[]>): F {
  for (const item of fake.items) for (const name of byTitle[item.title] ?? []) fake.tag(item.id, name);
  return fake;
}

/** Removes every match in place, so the arrays a test holds stay live. */
function drop<T>(list: T[], match: (entry: T) => boolean) {
  for (let i = list.length - 1; i >= 0; i--) if (match(list[i])) list.splice(i, 1);
}

let tagSeq = 0;
const tagId = () => `00000000-0000-4000-b000-${String(++tagSeq).padStart(12, "0")}` as TagId;

export const area = (name: string): Area => ({ id: uuid() as AreaId, name, position: 0, color: null });
