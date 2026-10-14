import type { Item, ItemId, LocalDate } from "@/domain/item";
import type { ExportTable, PageReader } from "@/features/account/export";
import { bodyText, type DocNode } from "@/features/notes/doc";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { fakeAreasRepo } from "@/lib/areas/fake";
import { recurrenceToColumns, scheduleToColumns } from "@/lib/items/mappers";
import { fakeNotesRepo, type NotesStore } from "@/lib/notes/fake";

// Loaded only through getFakeAccount in ./fake-session, which a production build drops.

const id = (n: number) => `e2e00000-0000-4000-8000-${String(n).padStart(12, "0")}` as ItemId;
const created = new Date("2026-10-01T09:00:00Z");

const gardenBody: DocNode = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Lift the dahlias before the first frost." }] }],
};

function fixtures(): Item[] {
  return [
    makeItem({ id: id(1), title: "Renew passport", createdAt: created }),
    makeItem({ id: id(2), type: "checklist", title: "Packing for Lisbon", createdAt: created }),
    makeItem({ id: id(3), title: "Passport", parentId: id(2), status: "done", position: 0, createdAt: created }),
    makeItem({ id: id(4), title: "Adapter plug", parentId: id(2), position: 1, createdAt: created }),
    // Dated far from any real "today", so the Due page's groups hold whenever the tests run.
    makeItem({ id: id(6), title: "File the tax form", schedule: { kind: "day", on: "2020-01-10" as LocalDate }, dueOn: "2020-01-15" as LocalDate, createdAt: created }),
    makeItem({ id: id(7), title: "Renew the lease", schedule: { kind: "day", on: "2099-05-20" as LocalDate }, dueOn: "2099-06-01" as LocalDate, createdAt: created }),
    // Planned for a day long past and still open, for the strip on Today.
    makeItem({ id: id(8), title: "Return the library books", schedule: { kind: "day", on: "2020-02-03" as LocalDate }, createdAt: created }),
    makeItem({ id: id(5), type: "note", title: "Garden through the winter", body: gardenBody, createdAt: created, updatedAt: created }),
  ];
}

/** Which in-memory account a request uses: the fixtures, or one that has never stored an item. */
export type FakeAccountKind = "fixtures" | "empty";

function createAccount(kind: FakeAccountKind) {
  const areas = fakeAreasRepo(["Work", "Home", "Health"]);
  const items = kind === "fixtures" ? fixtures() : [];
  const fake = fakeRepo(items);
  fake.repo.listAreas = () => areas.repo.list();
  if (kind === "fixtures") fake.tag(id(1), "errands");
  const notesStore: NotesStore = { items, bodyText: new Map(), links: [] };
  for (const i of items) if (i.type === "note") notesStore.bodyText.set(i.id, bodyText(i.body as DocNode | null));

  const userId = "e2e00000-0000-4000-8000-0000000000aa";
  const at = (d: Date) => d.toISOString();
  const tables: Record<ExportTable, () => unknown[]> = {
    areas: () =>
      areas.rows.map((a) => ({ ...a, created_at: at(created), updated_at: at(created), deleted_at: a.deletedAt && at(a.deletedAt) })),
    items: () =>
      items.map((i) => ({
        id: i.id,
        type: i.type,
        title: i.title,
        body: i.body,
        status: i.status,
        area_id: i.areaId,
        parent_id: i.parentId,
        position: i.position,
        ...scheduleToColumns(i.schedule),
        due_on: i.dueOn,
        ...recurrenceToColumns(i.recurrence),
        completed_at: i.completedAt && at(i.completedAt),
        created_at: at(i.createdAt),
        updated_at: at(i.updatedAt),
        deleted_at: null,
      })),
    links: () =>
      notesStore.links.map((l) => ({ id: l.id, from_id: l.fromId, to_id: l.toId, kind: "reference", created_at: at(created), updated_at: at(created) })),
    tags: () => fake.tags.map((t) => ({ id: t.id, name: t.name, created_at: at(created), updated_at: at(created) })),
    item_tags: () =>
      fake.itemTags.map((l) => ({ item_id: l.itemId, tag_id: l.tagId, created_at: at(created), updated_at: at(created) })),
  };
  const readExport: PageReader = async (table, from, to) => tables[table]().slice(from, to + 1);

  return {
    email: "e2e@axiis.invalid",
    userId,
    items: fake.repo,
    notes: fakeNotesRepo(notesStore),
    areas: areas.repo,
    readExport,
  };
}

export type FakeAccount = ReturnType<typeof createAccount> & { reset(): void };

// On globalThis so every route bundle in the one `next dev` process shares one account of each kind.
const holder = globalThis as typeof globalThis & {
  axiisE2EAccounts?: Partial<Record<FakeAccountKind, ReturnType<typeof createAccount>>>;
};

export function fakeAccount(kind: FakeAccountKind = "fixtures"): FakeAccount {
  const accounts = (holder.axiisE2EAccounts ??= {});
  const account = (accounts[kind] ??= createAccount(kind));
  return {
    ...account,
    reset() {
      accounts[kind] = createAccount(kind);
    },
  };
}
