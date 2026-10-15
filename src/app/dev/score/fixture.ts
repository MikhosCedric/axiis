import type { Area, AreaId, Item, ItemId } from "@/domain/item";
import { loadDay } from "@/features/day/load";
import type { DayData } from "@/features/day/types";
import { makeItem } from "@/features/today/test-support";
import { addDays, instantAt, localMinutes, toLocalDate } from "@/lib/dates";
import type { ItemsRepo } from "@/lib/items/repo";

// Fixture ids live in their own range so items captured in the harness never collide with them.
let seq = 0;
const id = () => `f0000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

export function seedFixture(now: Date, timeZone: string): { items: Item[]; areas: Area[] } {
  seq = 0;
  const date = toLocalDate(now, timeZone);
  const at = (h: number, m = 0) => instantAt(date, h * 60 + m, timeZone);
  const [work, home, health] = ["Work", "Home", "Health"].map(
    (name, position): Area => ({ id: id() as AreaId, name, position, color: null }),
  );
  const item = (over: Partial<Item>) => makeItem({ id: id() as ItemId, ...over });
  const timed = (title: string, area: Area | null, from: Date, to: Date, over: Partial<Item> = {}) =>
    item({ title, areaId: area?.id ?? null, schedule: { kind: "timed", start: from, end: to }, ...over });
  const done = { status: "done" as const, completedAt: now };

  const nowMin = localMinutes(now, date, timeZone);
  const liveFrom = Math.max(0, Math.floor(nowMin / 15) * 15 - 15);
  const liveTo = Math.min(1440, liveFrom + 60);

  const brief = timed("Write the launch brief", work, at(10), at(11, 30));
  const shop = timed("Weekly shop", home, at(17, 30), at(18, 15), { type: "checklist" });
  const passport = item({ title: "Renew passport", createdAt: at(8) });

  const items: Item[] = [
    timed("Plan the week", work, at(8, 30), at(9, 15), done),
    brief,
    timed("Design sync", work, at(13), at(14), { type: "event" }),
    timed("Review pull requests", work, at(13, 30), at(14, 45)),
    timed("Quick check-in", work, at(15), at(15, 15)),
    timed("Deep work on the pricing model and the long tail of edge cases", work, at(15, 15), at(18)),
    timed("Inbox, now", health, instantAt(date, liveFrom, timeZone), instantAt(date, liveTo, timeZone)),
    timed("Water the plants", home, at(7, 30), at(7, 45), done),
    timed("Call the landlord", home, at(12), at(12, 30)),
    shop,
    timed("Cook dinner", home, at(18, 30), at(19, 30)),
    timed("Run", health, at(6, 30), at(7, 15), done),
    timed("Stretch", health, at(17), at(17, 30)),
    timed("Late walk", health, at(21), at(21, 45)),
    timed("Dentist", null, at(16), at(16, 45), { type: "event" }),
    item({ title: "Pay the electricity bill", schedule: { kind: "day", on: date } }),
    item({ title: "Pick up dry cleaning", areaId: home.id, schedule: { kind: "day", on: date }, position: 1 }),
    passport,
    item({ title: "Reply to Marcus about the invoice", areaId: work.id, createdAt: at(9) }),
    item({ title: "Book the dentist", areaId: health.id, createdAt: at(7) }),
    item({ title: "Read the chapter on ownership", createdAt: at(6) }),
    item({ title: "Order printer ink", ...done, createdAt: at(5) }),
    item({ title: "Packing list", type: "checklist", areaId: home.id, createdAt: at(4) }),
  ];
  const sub = (parent: Item, title: string, isDone = false) =>
    item({ title, parentId: parent.id, ...(isDone ? done : {}) });
  items.push(
    sub(brief, "Outline", true),
    sub(brief, "Positioning", true),
    sub(brief, "Pricing slide"),
    sub(brief, "Metrics export"),
    sub(brief, "Final read"),
    ...["Oats", "Lemons", "Coffee beans", "Bin bags", "Dish soap"].map((t, i) => sub(shop, t, i < 2)),
    sub(passport, "Photos"),
  );

  // Repeating items: a daily stand-up drawn from its series, a stretch whose
  // occurrence today is already done (an override), a weekly any-time chore and
  // a daily one with no time yet.
  const weekAgo = addDays(date, -7);
  const daily = { freq: "daily", interval: 1, end: { kind: "never" } } as const;
  const standup = item({
    title: "Stand-up",
    type: "event",
    areaId: work.id,
    schedule: { kind: "timed", start: instantAt(weekAgo, 9 * 60 + 30, timeZone), end: instantAt(weekAgo, 9 * 60 + 45, timeZone) },
    recurrence: { kind: "series", rule: daily },
  });
  const stretch = item({
    title: "Stretch break",
    areaId: health.id,
    schedule: { kind: "timed", start: instantAt(weekAgo, 11 * 60 + 45, timeZone), end: instantAt(weekAgo, 12 * 60, timeZone) },
    recurrence: { kind: "series", rule: daily },
  });
  items.push(
    standup,
    stretch,
    timed("Stretch break", health, at(11, 45), at(12), { ...done, recurrence: { kind: "override", seriesId: stretch.id, originalOn: date } }),
    item({
      title: "Water the ferns",
      areaId: home.id,
      schedule: { kind: "day", on: weekAgo },
      recurrence: { kind: "series", rule: { freq: "weekly", interval: 1, byDay: [], end: { kind: "never" } } },
    }),
    item({ title: "Take vitamins", schedule: { kind: "day", on: addDays(date, -2) }, recurrence: { kind: "series", rule: daily } }),
  );
  return { items, areas: [work, home, health] };
}

/** The day query for the harness: the app's own loader, over the in-memory repo. */
export function loadDayData(repo: ItemsRepo, now: Date, timeZone: string): Promise<DayData> {
  return loadDay(repo, toLocalDate(now, timeZone), now, timeZone);
}

/** Tags on fixture items, by title. The stand-up's go on its series, so every occurrence wears them. */
export const SCORE_TAGS: Record<string, string[]> = {
  "Write the launch brief": ["launch", "writing"],
  "Stand-up": ["team"],
  "Renew passport": ["errands", "travel"],
  "Pay the electricity bill": ["bills"],
  "Reply to Marcus about the invoice": ["bills", "work admin", "follow-up"],
};
