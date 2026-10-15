import type { Area, AreaId, Item, ItemId, LocalDate } from "@/domain/item";
import { makeItem } from "@/features/today/test-support";
import { addDays, toLocalDate } from "@/lib/dates";

// Fixture ids live in their own range so items captured in the harness never collide with them.
let seq = 0;
const id = () => `f2000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

/** An inbox with tasks, an untimed event and a checklist, beside items the inbox must leave out. */
export function seedInbox(now: Date, timeZone: string): { items: Item[]; areas: Area[] } {
  seq = 0;
  const [work, home] = ["Work", "Home"].map((name, position): Area => ({ id: id() as AreaId, name, position, color: null }));
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const item = (title: string, ago: number, over: Partial<Item> = {}) =>
    makeItem({ id: id() as ItemId, title, createdAt: daysAgo(ago), updatedAt: daysAgo(ago), ...over });
  const today = toLocalDate(now, timeZone);

  const packing = item("Pack for the coast", 2, { type: "checklist", areaId: home.id });
  return {
    areas: [work, home],
    items: [
      item("Book the dentist", 0.1, { areaId: home.id }),
      item("Call the bank back about the card", 0.5, { type: "event" }),
      packing,
      item("Sunscreen", 2, { parentId: packing.id }),
      item("Charger", 2, { parentId: packing.id, status: "done" }),
      item("Draft the quarterly review notes for the whole team, with every open question from the last retro", 4, {
        areaId: work.id,
      }),
      item("Return the library books", 9),
      item("Garden ideas", 1, { type: "note" }),
      item("Renew the passport", 3, { status: "done", completedAt: daysAgo(1) }),
      item("Water the plants", 1, { schedule: { kind: "day", on: addDays(today, 1) as LocalDate } }),
    ],
  };
}

/** Tags on fixture items, by title. */
export const INBOX_TAGS: Record<string, string[]> = {
  "Book the dentist": ["health", "errands"],
  "Return the library books": ["errands"],
  "Draft the quarterly review notes for the whole team, with every open question from the last retro": ["writing"],
};
