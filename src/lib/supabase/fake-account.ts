import type { Area, Item, ItemId, LocalDate } from "@/domain/item";
import type { ExportTable, PageReader } from "@/features/account/export";
import { bodyText, type DocNode } from "@/features/notes/doc";
import { fakeRepo, makeItem } from "@/features/today/test-support";
import { memoryDeletionPort } from "@/lib/account/fake";
import { fakeAreasRepo } from "@/lib/areas/fake";
import { recurrenceToColumns, scheduleToColumns } from "@/lib/items/mappers";
import { fakeNotesRepo, type NotesStore } from "@/lib/notes/fake";
import { addDays, instantAt, localMinutes, toLocalDate } from "@/lib/dates";

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

const areaDay = "2099-05-20" as LocalDate;

/** Items in areas, for the area colour test, on a day no real "today" meets. The other accounts' items have no area. */
function areaFixtures(areas: Area[]): Item[] {
  const [work, home] = areas;
  return [
    makeItem({
      id: id(21),
      title: "Draft the budget",
      areaId: work.id,
      schedule: { kind: "timed", start: new Date(`${areaDay}T10:00:00Z`), end: new Date(`${areaDay}T11:30:00Z`) },
      createdAt: created,
    }),
    makeItem({ id: id(22), title: "Water the ferns", areaId: home.id, schedule: { kind: "day", on: areaDay }, createdAt: created }),
    makeItem({ id: id(23), title: "Sort the receipts", areaId: work.id, createdAt: created }),
  ];
}

/**
 * A busy week around the real today, in the server's own zone (the browser's, on one machine), for the orientation
 * tests and for looking at a full day by hand: events and tasks on the Score, one happening now, some done, a few
 * waiting, left over, past due and repeating.
 */
function busyFixtures(areas: Area[], now: Date): Item[] {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = toLocalDate(now, zone);
  const [work, home, health] = areas.map((a) => a.id);
  const at = (date: LocalDate, hh: number, mm = 0) => instantAt(date, hh * 60 + mm, zone);
  const timed = (date: LocalDate, from: [number, number], to: [number, number]) =>
    ({ kind: "timed", start: at(date, ...from), end: at(date, ...to) }) as const;
  const day = (on: LocalDate) => ({ kind: "day", on }) as const;
  const doneAt = (d: Date) => ({ status: "done" as const, completedAt: d });
  const quarter = Math.floor(localMinutes(now, today, zone) / 15) * 15;
  const live = { kind: "timed", start: instantAt(today, Math.max(0, quarter - 15), zone), end: instantAt(today, Math.min(1440, quarter + 45), zone) } as const;
  const make = (n: number, over: Partial<Item>) => makeItem({ id: id(100 + n), createdAt: created, updatedAt: created, ...over });
  return [
    make(1, { title: "Morning run", areaId: health, schedule: timed(today, [7, 0], [7, 45]), ...doneAt(at(today, 7, 50)) }),
    make(2, {
      type: "event",
      title: "Standup",
      areaId: work,
      schedule: timed(addDays(today, -14), [9, 30], [9, 45]),
      recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: ["MO", "TU", "WE", "TH", "FR"], end: { kind: "never" } } },
    }),
    make(3, { title: "Write the Q4 plan", areaId: work, schedule: timed(today, [10, 0], [11, 30]), ...doneAt(at(today, 11, 20)) }),
    make(4, { type: "event", title: "Dentist", areaId: health, schedule: timed(today, [12, 30], [13, 15]) }),
    make(5, { title: "Focus block", areaId: work, schedule: live }),
    make(6, { type: "event", title: "Design sync", areaId: work, schedule: timed(today, [16, 0], [17, 0]) }),
    make(7, { title: "Call the plumber", areaId: home, schedule: timed(today, [18, 0], [18, 15]) }),
    make(8, { title: "Send the invoice", areaId: work, schedule: day(today), dueOn: today }),
    make(9, { type: "checklist", title: "Groceries", areaId: home, schedule: day(today) }),
    make(10, { title: "Milk", parentId: id(109), position: 0, ...doneAt(at(today, 8, 0)) }),
    make(11, { title: "Eggs", parentId: id(109), position: 1 }),
    make(12, { title: "Coffee", parentId: id(109), position: 2 }),
    make(13, { title: "Water the plants", areaId: home, schedule: day(today), ...doneAt(at(today, 8, 10)) }),
    make(14, { title: "Book flights to Lisbon", schedule: { kind: "unscheduled" } }),
    make(15, { title: "Read the lease", areaId: home, schedule: { kind: "unscheduled" } }),
    make(16, { title: "Pick a birthday gift", schedule: { kind: "unscheduled" }, dueOn: addDays(today, 4) }),
    make(17, { title: "Return the library books", areaId: home, schedule: day(addDays(today, -3)) }),
    make(18, { title: "File the expense report", areaId: work, schedule: day(addDays(today, -2)), dueOn: addDays(today, -1) }),
    make(19, { type: "event", title: "Yoga", areaId: health, schedule: timed(addDays(today, 1), [18, 30], [19, 30]) }),
    make(20, { title: "Prepare the board deck", areaId: work, schedule: day(addDays(today, 2)), dueOn: addDays(today, 3) }),
    make(21, { type: "event", title: "Dinner with Sam", areaId: home, schedule: timed(addDays(today, 3), [19, 0], [21, 0]) }),
    make(22, { title: "Renew the car insurance", areaId: home, schedule: day(addDays(today, 5)), dueOn: addDays(today, 9) }),
    make(23, { type: "checklist", title: "Packing for Lisbon", schedule: { kind: "unscheduled" } }),
    make(24, { title: "Passport", parentId: id(123), position: 0 }),
    make(25, { title: "Adapter plug", parentId: id(123), position: 1 }),
    make(26, { type: "note", title: "Q4 plan notes", body: gardenBody }),
  ];
}

/**
 * Which in-memory account a request uses: the fixtures, one that has never stored an item, one whose items sit
 * in areas, the same again with a tag for the filter tests, a busy week, a second busy week for the navigation tests
 * to change, or a copy of the fixtures for the account deletion tests.
 */
export type FakeAccountKind = "fixtures" | "empty" | "areas" | "filters" | "busy" | "navigation" | "gestures" | "polish" | "deletion";

function createAccount(kind: FakeAccountKind) {
  const busy = kind === "busy" || kind === "navigation" || kind === "gestures" || kind === "polish";
  const areas =
    busy
      ? fakeAreasRepo([
          { name: "Work", color: "slate" },
          { name: "Home", color: "ochre" },
          { name: "Health", color: "moss" },
        ])
      : fakeAreasRepo(["Work", "Home", "Health"]);
  const items =
    kind === "fixtures" || kind === "deletion"
      ? fixtures()
      : kind === "areas" || kind === "filters"
        ? areaFixtures(areas.rows)
        : busy
          ? busyFixtures(areas.rows, new Date())
          : [];
  const fake = fakeRepo(items);
  fake.repo.listAreas = () => areas.repo.list();
  if (kind === "fixtures") fake.tag(id(1), "errands");
  // One tag across two areas, for the tag colour and tag filter tests.
  if (kind === "filters") for (const each of [id(22), id(23)]) fake.tag(each, "errands");
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
    tags: () => fake.tags.map((t) => ({ id: t.id, name: t.name, color: t.color, created_at: at(created), updated_at: at(created) })),
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
    deletion: memoryDeletionPort(),
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
