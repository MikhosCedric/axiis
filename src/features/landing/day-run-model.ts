/**
 * The day the landing runs through as the reader scrolls "How it works": a fixed day of made-up items
 * on wall-clock hours, from seven in the morning to eleven at night. Scrolling the stage carries now
 * across it, so each beam turns from dashed to solid to hollow at the share of the scroll its hour sits at.
 */
export type RunBeam = { title: string; start: number; end: number };

export type RunStaff = { name: string; beams: RunBeam[] };

export const RUN_AXIS = { from: 7, to: 23 } as const;

/** Made-up items. Nothing here describes a real person. */
export const RUN_STAVES: RunStaff[] = [
  {
    name: "Work",
    beams: [
      { title: "Write the plan", start: 9, end: 10.5 },
      { title: "Design review", start: 11, end: 12 },
      { title: "Reply to the venue", start: 14.25, end: 15 },
      { title: "Plan next week", start: 16.25, end: 17.5 },
    ],
  },
  {
    name: "Home",
    beams: [
      { title: "Call the landlord", start: 12.5, end: 13 },
      { title: "Groceries", start: 18, end: 18.75 },
      { title: "Cook dinner", start: 19.5, end: 20.5 },
    ],
  },
  {
    name: "Health",
    beams: [
      { title: "Easy run", start: 7.5, end: 8.25 },
      { title: "Physio exercises", start: 13.25, end: 13.75 },
      { title: "Yoga class", start: 20.75, end: 21.75 },
    ],
  },
];

export const PHASES = [
  { name: "Morning", from: 7, to: 12 },
  { name: "Afternoon", from: 12, to: 17 },
  { name: "Evening", from: 17, to: 23 },
] as const;

/** The moment drawn when nothing moves (reduced motion, or a browser without scroll-driven animations). */
export const STILL_HOUR = 14.5;

/** Now runs in quarter hours on the clock flag, so the flag never says a whole hour the line has left. */
export const FLAG_STEP = 0.25;

/** How far through the run, from 0 to 1, now reaches `hour`. */
export function shareOf(hour: number): number {
  return (hour - RUN_AXIS.from) / (RUN_AXIS.to - RUN_AXIS.from);
}

/** The scroll range, as CSS percentages of the run, over which a change at `hour` takes place. */
export function rangeAt(hour: number): { from: string; to: string } {
  const at = shareOf(hour) * 100;
  return { from: `${round(at)}%`, to: `${round(Math.min(100, at + 1.5))}%` };
}

const round = (n: number) => Math.round(n * 100) / 100;
