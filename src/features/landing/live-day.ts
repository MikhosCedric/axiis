import type { BeamState } from "@/features/today/model";

/**
 * Hours counted from the start of the hour the visitor is in, so 0 is the top of this hour and
 * -2.5 is half past, two hours ago. The sample day is laid out around now in these units, which
 * keeps the now line inside the drawn window at any time of day and every beam on its side of it.
 */
export type RelHour = number;

export type LiveBeam = {
  title: string;
  start: RelHour;
  end: RelHour;
  row: 0 | 1;
  /** Subtasks done out of total, as the real Score prints them. */
  progress?: { done: number; total: number };
};

export type LiveStaff = { name: string; rows: 1 | 2; beams: LiveBeam[] };

/** Made-up items. Nothing here describes a real person. */
export const LIVE_STAVES: LiveStaff[] = [
  {
    name: "Work",
    rows: 2,
    beams: [
      { title: "Write the quarterly summary", start: -4.5, end: -3, row: 0 },
      { title: "Review Ana's draft", start: -0.5, end: 1.25, row: 1, progress: { done: 2, total: 3 } },
      { title: "Plan next week", start: 2, end: 3.5, row: 0, progress: { done: 1, total: 4 } },
      { title: "Reply to the venue", start: 4, end: 4.5, row: 1 },
    ],
  },
  {
    name: "Home",
    rows: 1,
    beams: [
      { title: "Water the plants", start: -3.75, end: -3.5, row: 0 },
      { title: "Call the landlord", start: 1.5, end: 1.75, row: 0 },
      { title: "Groceries", start: 5.5, end: 6.25, row: 0 },
    ],
  },
  {
    name: "Health",
    rows: 1,
    beams: [
      { title: "Easy run", start: -2.5, end: -1.75, row: 0 },
      { title: "Physio exercises", start: 2.5, end: 3, row: 0 },
      { title: "Yoga class", start: 6, end: 7, row: 0 },
    ],
  },
];

export const LIVE_TRAY = ["Book the dentist", "Renew passport", "Birthday card for Sam"];

/** The Inbox chip the loop lifts onto a staff, and where it lands. */
export const LANDING = { title: LIVE_TRAY[0], staff: 2, start: 1.25, end: 2 } as const;

/** Hours of the widest window drawn (the narrower ones are inside it), from first to last barline. */
export const WIDEST = { from: -5, to: 7 } as const;

/** Where the server draws now, before the browser knows the visitor's clock: 11:20. */
export const SERVER_MINUTES = 11 * 60 + 20;

const DAY_MINUTES = 24 * 60;

/** The hour now is in, and how far into it, as a fraction. */
export function nowParts(minutes: number): { hour: number; into: number } {
  const m = ((Math.floor(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return { hour: Math.floor(m / 60), into: (m % 60) / 60 };
}

/** A beam's line form at `into` hours past the top of this hour: hollow once over, solid while on, dashed before. */
export function stateAt(beam: Pick<LiveBeam, "start" | "end">, into: number): BeamState {
  if (beam.end <= into) return "done";
  if (beam.start <= into) return "live";
  return "planned";
}

/** Wall-clock minutes of a relative hour, given the hour now is in. Wraps past midnight either way. */
export function wallMinutesOf(rel: RelHour, hour: number): number {
  return ((Math.round((hour + rel) * 60) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

/** Hours of free line after a beam on its row, so its label can run on without reaching the next one. */
export function roomAfter(staff: LiveStaff, beam: LiveBeam, windowEnd: RelHour): number {
  const next = staff.beams
    .filter((b) => b.row === beam.row && b.start >= beam.end)
    .reduce((min, b) => Math.min(min, b.start), windowEnd);
  return next - beam.start;
}
