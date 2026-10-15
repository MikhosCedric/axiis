import type { Area, AreaId, Item, ItemId, LocalDate } from "@/domain/item";
import { fakeRepo, makeItem } from "@/features/today/test-support";

// Fixture ids live in their own range so items captured in the harness never collide with them.
const id = (n: number) => `f3000000-0000-4000-8000-${String(n).padStart(12, "0")}` as ItemId;
const areaId = (n: number) => `f3000000-0000-4000-9000-${String(n).padStart(12, "0")}` as AreaId;
const at = (day: string) => new Date(`2026-${day}T09:00:00Z`);

const AREAS: Area[] = [
  { id: areaId(1), name: "Work", position: 0, color: null },
  { id: areaId(2), name: "Home", position: 1, color: null },
];

/** Checklists in every state the page draws, beside items it must leave out. */
function fixtures(): Item[] {
  const checklist = (n: number, title: string, created: string, over: Partial<Item> = {}) =>
    makeItem({ id: id(n), type: "checklist", title, createdAt: at(created), updatedAt: at(created), ...over });
  const line = (n: number, parent: number, title: string, done = false) =>
    makeItem({ id: id(n), parentId: id(parent), title, status: done ? "done" : "open", position: n });
  return [
    checklist(1, "Pack for the coast", "10-04", { areaId: areaId(2) }),
    line(11, 1, "Sunscreen"),
    line(12, 1, "Charger", true),
    line(13, 1, "Walking boots"),
    checklist(2, "Launch day", "10-02", { areaId: areaId(1), schedule: { kind: "day", on: "2026-10-09" as LocalDate } }),
    line(21, 2, "Freeze the copy", true),
    line(22, 2, "Check the redirects", true),
    line(23, 2, "Post the note to the team"),
    line(24, 2, "Watch the error log for an hour"),
    checklist(3, "Weekly reset", "09-20", {
      schedule: { kind: "day", on: "2026-10-04" as LocalDate },
      recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "never" } } },
    }),
    checklist(4, "Ideas for the garden", "10-05"),
    checklist(5, "Move the flat", "09-01", { status: "done", completedAt: at("09-28") }),
    line(51, 5, "Boxes", true),
    line(52, 5, "Meter readings", true),
    checklist(6, "Weekly reset, moved", "10-01", {
      schedule: { kind: "day", on: "2026-10-12" as LocalDate },
      recurrence: { kind: "override", seriesId: id(3), originalOn: "2026-10-11" as LocalDate },
    }),
    checklist(7, "Never mind", "10-03", { status: "dropped" }),
    makeItem({ id: id(8), title: "Book the dentist", createdAt: at("10-05") }),
  ];
}

/** One store per browser tab, so edits in the detail sheet show on the list. `empty` starts with nothing. */
export const stores = { full: fakeRepo(fixtures(), AREAS), empty: fakeRepo([], AREAS) };
export const settings = { failing: false };
