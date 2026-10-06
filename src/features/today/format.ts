import type { LocalDate } from "@/domain/item";

const heading = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** "Tuesday 6 October". The date is already local, so it is formatted as a UTC calendar day. */
export function formatDayHeading(date: LocalDate): string {
  return heading.format(new Date(`${date}T12:00:00Z`));
}

/** `formatDayHeading`, with the year when it is not the year of `today`: "Thursday 7 January 2027". */
export function formatDayIn(date: LocalDate, today: LocalDate): string {
  const year = date.slice(0, 4) === today.slice(0, 4) ? "" : ` ${date.slice(0, 4)}`;
  return `${formatDayHeading(date)}${year}`;
}

const clocks = new Map<string, Intl.DateTimeFormat>();

/** 24-hour "09:30" in the user's zone. */
export function formatClock(at: Date, timeZone: string): string {
  let f = clocks.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });
    clocks.set(timeZone, f);
  }
  return f.format(at);
}
