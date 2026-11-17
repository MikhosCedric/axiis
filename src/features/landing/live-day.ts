import type { AreaColor } from "@/domain/area-color";
import type { BeamState } from "@/features/today/model";

/**
 * Hours counted from the start of the hour the visitor is in, so 0 is the top of this hour and
 * -2.5 is half past, two hours ago. The sample is laid out around now in these units, which keeps
 * the now line inside the drawn window at any time of day and every block on its side of it.
 */
export type RelHour = number;

export type LiveBlock = {
  title: string;
  /** 0 is today, 1 tomorrow, 2 the day after. */
  day: 0 | 1 | 2;
  start: RelHour;
  end: RelHour;
  area: "Work" | "Home" | "Health";
  /** Subtasks done out of total, as the app prints them. */
  progress?: { done: number; total: number };
};

export const LIVE_AREAS: Record<LiveBlock["area"], AreaColor> = { Work: "indigo", Home: "ochre", Health: "sage" };

/** Made-up items. Nothing here describes a real person. */
export const LIVE_BLOCKS: LiveBlock[] = [
  { title: "Easy run", day: 0, start: -3, end: -2.25, area: "Health" },
  { title: "Write the quarterly summary", day: 0, start: -2.25, end: -0.5, area: "Work" },
  { title: "Review Ana's draft", day: 0, start: -0.5, end: 1.25, area: "Work", progress: { done: 2, total: 3 } },
  { title: "Plan next week", day: 0, start: 2.25, end: 3.75, area: "Work", progress: { done: 1, total: 4 } },
  { title: "Physio exercises", day: 0, start: 3, end: 3.5, area: "Health" },
  { title: "Call the landlord", day: 0, start: 4, end: 4.25, area: "Home" },
  { title: "Groceries", day: 0, start: 5, end: 5.75, area: "Home" },

  { title: "Dentist", day: 1, start: -1.5, end: -0.5, area: "Health" },
  { title: "Design review", day: 1, start: 0.5, end: 2, area: "Work" },
  { title: "Reply to the venue", day: 1, start: 1.5, end: 2.25, area: "Work" },
  { title: "Cook for the week", day: 1, start: 3.5, end: 5, area: "Home" },

  { title: "Send the invoices", day: 2, start: -2, end: -1, area: "Work" },
  { title: "Yoga class", day: 2, start: 1, end: 2, area: "Health" },
  { title: "Laundry", day: 2, start: 3, end: 3.75, area: "Home" },
];

/** Planned for a day with no time: the Any time row. */
export const LIVE_ANYTIME: { title: string; day: 0 | 1 | 2; area: LiveBlock["area"] }[] = [
  { title: "Water the plants", day: 0, area: "Home" },
  { title: "Order the cake", day: 1, area: "Home" },
];

export const LIVE_TRAY = ["Book the dentist", "Renew passport", "Birthday card for Sam"];

/** The Inbox chip the loop lifts onto the day, and where it lands: today, in a free stretch. */
export const LANDING = { title: LIVE_TRAY[0], day: 0, start: 1.5, end: 2, area: "Health" } as const;

/** The hours drawn, relative to the hour now is in, from the first rule to the last. */
export const LIVE_WINDOW = { from: -3, to: 6 } as const;

/** Where the server draws now, before the browser knows the visitor's clock: 11:20. */
export const SERVER_MINUTES = 11 * 60 + 20;

const DAY_MINUTES = 24 * 60;

/** The hour now is in, and how far into it, as a fraction. */
export function nowParts(minutes: number): { hour: number; into: number } {
  const m = ((Math.floor(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return { hour: Math.floor(m / 60), into: (m % 60) / 60 };
}

/** A block's line form at `into` hours past the top of this hour: hollow once over, solid while on, dashed before. */
export function stateAt(block: Pick<LiveBlock, "start" | "end">, into: number): BeamState {
  if (block.end <= into) return "done";
  if (block.start <= into) return "live";
  return "planned";
}

/** A block's state on its own day: only today's has begun. */
export function stateOn(block: Pick<LiveBlock, "start" | "end" | "day">, into: number): BeamState {
  return block.day === 0 ? stateAt(block, into) : "planned";
}

/** Wall-clock minutes of a relative hour, given the hour now is in. Wraps past midnight either way. */
export function wallMinutesOf(rel: RelHour, hour: number): number {
  return ((Math.round((hour + rel) * 60) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

/** Minutes on the grid's own axis, which runs on past midnight rather than wrapping: the hour now is in, plus `rel`. */
export function axisMinutes(rel: RelHour, hour: number): number {
  return Math.round((hour + rel) * 60);
}
