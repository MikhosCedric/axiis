import type { LocalDate } from "@/domain/item";

const heading = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** "Tuesday 6 October". The date is already local, so it is formatted as a UTC calendar day. */
export function formatDayHeading(date: LocalDate): string {
  return heading.format(new Date(`${date}T12:00:00Z`));
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
