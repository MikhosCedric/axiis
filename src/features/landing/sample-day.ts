import type { BeamState } from "@/features/today/model";

/** Hours as decimals of a local day, so 10.75 is 10:45. The sample never crosses midnight. */
type Hour = number;

export type SampleBeam = {
  title: string;
  start: Hour;
  end: Hour;
  state: BeamState;
  row: 0 | 1;
  /** Subtasks done out of total, as the real Score prints them. */
  progress?: { done: number; total: number };
};

export type SampleStaff = { name: string; rows: 1 | 2; beams: SampleBeam[] };

/** A made-up day, drawn on the landing page as the Score. Nothing here describes a real person. */
export const SAMPLE_NOW: Hour = 11 + 20 / 60;

export const SAMPLE_STAVES: SampleStaff[] = [
  {
    name: "Work",
    rows: 2,
    beams: [
      { title: "Write the quarterly summary", start: 8.5, end: 10, state: "done", row: 0 },
      { title: "Review Ana's draft", start: 10.75, end: 12.25, state: "live", row: 1, progress: { done: 2, total: 3 } },
      { title: "Plan next week", start: 14, end: 15.5, state: "planned", row: 0, progress: { done: 1, total: 4 } },
      { title: "Reply to the venue", start: 16, end: 16.5, state: "planned", row: 1 },
    ],
  },
  {
    name: "Home",
    rows: 1,
    beams: [
      { title: "Water the plants", start: 7.5, end: 7.75, state: "done", row: 0 },
      { title: "Call the landlord", start: 12.5, end: 12.75, state: "planned", row: 0 },
      { title: "Groceries", start: 17.5, end: 18.25, state: "planned", row: 0 },
    ],
  },
  {
    name: "Health",
    rows: 1,
    beams: [
      { title: "Easy run", start: 7, end: 7.75, state: "done", row: 0 },
      { title: "Physio exercises", start: 13, end: 13.5, state: "planned", row: 0 },
      { title: "Yoga class", start: 18, end: 19, state: "planned", row: 0 },
    ],
  },
];

export const SAMPLE_TRAY = ["Renew passport", "Book the dentist", "Birthday card for Sam"];

export function clock(hour: Hour): string {
  const minutes = Math.round(hour * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Hours of free line after a beam on its row, so its label can run on without hitting the next one. */
export function roomAfter(staff: SampleStaff, beam: SampleBeam, dayEnd: Hour): Hour {
  const next = staff.beams
    .filter((b) => b.row === beam.row && b.start >= beam.end)
    .reduce((min, b) => Math.min(min, b.start), dayEnd);
  return next - beam.start;
}
