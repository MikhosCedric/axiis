import { wallMinutes } from "./dates";

/** How a time of day is written: "09:30" on the 24-hour clock, "9:30 AM" on the 12-hour one. */
export type Clock = "12" | "24";

const DAY_MINUTES = 24 * 60;
/** Between a time and AM or PM, so a narrow label never breaks "9:30 AM" over two lines. */
const NBSP = " ";

const pad = (n: number) => String(n).padStart(2, "0");
const wrap = (minutes: number) => ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

/** Wall-clock minutes past midnight, wrapping past the end of the day: "09:30" or "9:30 AM" for 570. */
export function formatMinutes(minutes: number, clock: Clock): string {
  const m = wrap(minutes);
  const hour = Math.floor(m / 60);
  if (clock === "24") return `${pad(hour)}:${pad(m % 60)}`;
  return `${hour % 12 || 12}:${pad(m % 60)}${NBSP}${hour < 12 ? "AM" : "PM"}`;
}

/** An hour on the Score's axis: "09", or "9 AM" with midnight "12 AM" and noon "12 PM". */
export function formatHour(hour: number, clock: Clock): string {
  const h = ((hour % 24) + 24) % 24;
  if (clock === "24") return pad(h);
  return `${h % 12 || 12}${NBSP}${h < 12 ? "AM" : "PM"}`;
}

/**
 * The time `at` shows on a clock in `timeZone`. Written by hand rather than by
 * Intl's 12-hour output, whose space before AM differs between ICU versions,
 * so the server and the browser always write the same characters.
 */
export function formatClock(at: Date, timeZone: string, clock: Clock): string {
  return formatMinutes(wallMinutes(at, timeZone), clock);
}

/**
 * Minutes past midnight for a time typed on either clock, or null: "14:30",
 * "14.30", "1430", "930", "9", "9am", "9 pm", "9:30pm", "9.30 p.m.", "12am" (midnight).
 */
export function parseClock(text: string): number | null {
  const m = /^(\d{1,2})(?:[:.]?(\d{2}))?\s*(?:([ap])\.?(?:m\.?)?)?$/.exec(text.trim().toLowerCase());
  if (!m) return null;
  const [hours, minutes, half] = [Number(m[1]), Number(m[2] ?? 0), m[3]];
  if (minutes >= 60) return null;
  if (half === undefined) return hours < 24 ? hours * 60 + minutes : null;
  if (hours < 1 || hours > 12) return null;
  return ((hours % 12) + (half === "p" ? 12 : 0)) * 60 + minutes;
}

/**
 * The clock this browser's language and region use. Browser only. Asks for
 * the browser's first language by name: Intl's own default can be the
 * operating system's region instead, which an emulated locale does not change.
 */
export function deviceClock(): Clock {
  const cycle = new Intl.DateTimeFormat(navigator.languages?.[0] ?? navigator.language, { hour: "numeric" }).resolvedOptions().hourCycle;
  return cycle === "h11" || cycle === "h12" ? "12" : "24";
}
