import type { Area, AreaId, Item, ItemId, LocalDate } from "@/domain/item";
import { fakeRepo, makeItem } from "@/features/today/test-support";

export const BASE = "/dev/tags";
export const harnessTagHref = (name: string) => `${BASE}/${encodeURIComponent(name)}`;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as ItemId;
const areaId = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}` as AreaId;

const AREAS: Area[] = [
  { id: areaId(1), name: "Work", position: 0 },
  { id: areaId(2), name: "Home", position: 1 },
];

function fixtures(): Item[] {
  return [
    makeItem({ id: id(1), title: "Renew passport", areaId: areaId(2), createdAt: new Date("2026-10-01T09:00:00Z") }),
    makeItem({
      id: id(2),
      title: "Post the parcel to Ana",
      schedule: { kind: "day", on: "2026-10-08" as LocalDate },
      createdAt: new Date("2026-10-03T09:00:00Z"),
    }),
    makeItem({ id: id(3), title: "Return the library books", status: "done", createdAt: new Date("2026-10-04T09:00:00Z") }),
    makeItem({
      id: id(4),
      title: "Water the ferns",
      areaId: areaId(2),
      schedule: { kind: "day", on: "2026-10-04" as LocalDate },
      recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "never" } } },
      createdAt: new Date("2026-09-20T09:00:00Z"),
    }),
    makeItem({ id: id(5), type: "note", title: "Shops that still take cash", createdAt: new Date("2026-09-28T09:00:00Z") }),
    makeItem({
      id: id(6),
      title: "Write the launch brief",
      areaId: areaId(1),
      schedule: { kind: "timed", start: new Date("2026-10-07T10:00:00Z"), end: new Date("2026-10-07T11:30:00Z") },
      createdAt: new Date("2026-10-02T09:00:00Z"),
    }),
  ];
}

function createStore() {
  const fake = fakeRepo(fixtures(), AREAS);
  fake.tag(id(1), "errands", "travel");
  fake.tag(id(2), "errands");
  fake.tag(id(3), "errands");
  fake.tag(id(4), "errands", "Home care");
  fake.tag(id(5), "errands");
  fake.tag(id(6), "launch", "Deep work");
  return fake;
}

/** One store per browser tab, so client navigation between harness pages keeps edits. */
export const store = createStore();
export const settings = { failing: false };
