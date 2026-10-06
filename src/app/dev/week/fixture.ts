import type { Area, AreaId, Item, ItemId, LocalDate } from "@/domain/item";
import { makeItem } from "@/features/today/test-support";
import { weekOf } from "@/features/week/model";
import { addDays, instantAt, localMinutes, toLocalDate } from "@/lib/dates";

// Fixture ids live in their own range so items captured in the harness never collide with them.
let seq = 0;
const id = () => `f1000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

/** A full week around `shown`: busy days, a quiet day, done and live items, and a waiting tray. */
export function seedWeek(shown: LocalDate, now: Date, timeZone: string): { items: Item[]; areas: Area[] } {
  seq = 0;
  const days = weekOf(shown);
  const [work, home, health] = ["Work", "Home", "Health"].map(
    (name, position): Area => ({ id: id() as AreaId, name, position }),
  );
  const item = (over: Partial<Item>) => makeItem({ id: id() as ItemId, ...over });
  const timed = (day: number, title: string, area: Area | null, h: number, m: number, minutes: number, over: Partial<Item> = {}) =>
    item({
      title,
      areaId: area?.id ?? null,
      schedule: {
        kind: "timed",
        start: instantAt(days[day], h * 60 + m, timeZone),
        end: instantAt(days[day], h * 60 + m + minutes, timeZone),
      },
      ...over,
    });
  const anyTime = (day: number, title: string, area: Area | null, over: Partial<Item> = {}) =>
    item({ title, areaId: area?.id ?? null, schedule: { kind: "day", on: days[day] }, ...over });
  const done = { status: "done" as const, completedAt: now };

  // A weekday stand-up that started the week before: skipped on day 2, and day 3's moved to day 4 at 15:00.
  const standup = item({
    title: "Stand-up",
    type: "event",
    areaId: work.id,
    schedule: {
      kind: "timed",
      start: instantAt(addDays(days[0], -7), 9 * 60 + 30, timeZone),
      end: instantAt(addDays(days[0], -7), 9 * 60 + 45, timeZone),
    },
    recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: ["MO", "TU", "WE", "TH", "FR"], end: { kind: "never" } } },
  });
  const overrideOf = (day: number) => ({ kind: "override" as const, seriesId: standup.id, originalOn: days[day] });

  const items: Item[] = [
    standup,
    anyTime(2, "Stand-up", work, { type: "event", status: "dropped", recurrence: overrideOf(2) }),
    timed(4, "Stand-up, moved", work, 15, 0, 15, { type: "event", recurrence: overrideOf(3) }),
    timed(0, "Plan the week", work, 8, 30, 45, done),
    timed(0, "Design sync", work, 13, 0, 60, { type: "event" }),
    anyTime(0, "Pay the electricity bill", home),
    timed(1, "Write the launch brief", work, 10, 0, 90),
    timed(1, "Run", health, 6, 30, 45, done),
    timed(1, "Call the landlord", home, 12, 0, 30),
    timed(2, "Review pull requests", work, 9, 0, 75),
    timed(2, "Deep work on the pricing model and the long tail of edge cases", work, 14, 0, 180),
    anyTime(2, "Pick up dry cleaning", home, { position: 1 }),
    anyTime(2, "Renew the car insurance", null),
    timed(3, "Dentist", null, 16, 0, 45, { type: "event" }),
    timed(3, "Stretch", health, 17, 0, 30),
    timed(4, "Weekly shop", home, 17, 30, 45, { type: "checklist" }),
    timed(4, "Ship the release notes", work, 11, 0, 60),
    timed(5, "Long walk", health, 10, 0, 120),
    anyTime(5, "Clean the gutters", home),
    item({ title: "Renew passport", createdAt: new Date(now.getTime() - 3_600_000) }),
    item({ title: "Reply to Marcus about the invoice", areaId: work.id, createdAt: new Date(now.getTime() - 7_200_000) }),
    item({ title: "Book the dentist", areaId: health.id, createdAt: new Date(now.getTime() - 10_800_000) }),
    item({ title: "Read the chapter on ownership", createdAt: new Date(now.getTime() - 14_400_000) }),
    item({ title: "Packing list", type: "checklist", areaId: home.id, createdAt: new Date(now.getTime() - 18_000_000) }),
  ];

  // Something happening now, when the week shown holds today.
  const today = toLocalDate(now, timeZone);
  const index = days.indexOf(today);
  if (index >= 0) {
    const from = Math.max(0, Math.floor(localMinutes(now, today, timeZone) / 15) * 15 - 15);
    items.push(
      item({
        title: "Inbox, now",
        areaId: health.id,
        schedule: {
          kind: "timed",
          start: instantAt(today, from, timeZone),
          end: instantAt(today, Math.min(1440, from + 60), timeZone),
        },
      }),
    );
  }
  return { items, areas: [work, home, health] };
}

/** Tags on fixture items, by title. The stand-up's go on its series, so every occurrence wears them. */
export const WEEK_TAGS: Record<string, string[]> = {
  "Write the launch brief": ["launch", "writing"],
  "Stand-up": ["team"],
  "Pay the electricity bill": ["bills"],
  "Renew passport": ["errands", "travel", "admin"],
};
