import { RRule, type Weekday as RRuleWeekday } from "rrule";
import type { ItemId, LocalDate, Schedule, SpanRange } from "@/domain/item";
import { occurrenceKey } from "@/domain/item-key";
import { WEEKDAYS, type Rule, type Weekday } from "@/domain/recurrence";
import { instantAt, localMinutes, toLocalDate } from "@/lib/dates";

/** Hard ceiling on occurrences from one series in one read, whatever the span. */
export const MAX_OCCURRENCES = 400;

export type SeriesSource = { id: ItemId; schedule: Schedule; rule: Rule };

/** One occurrence of a series, computed, never stored. */
export type Occurrence = { seriesId: ItemId; originalOn: LocalDate; schedule: Exclude<Schedule, { kind: "unscheduled" }> };

const FREQ = { daily: RRule.DAILY, weekly: RRule.WEEKLY, monthly: RRule.MONTHLY, yearly: RRule.YEARLY } as const;
const DAYS: Record<Weekday, RRuleWeekday> = {
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
  SU: RRule.SU,
};

const floating = (date: LocalDate) => new Date(`${date}T00:00:00Z`);
const MS_PER_DAY = 86_400_000;
const dayNumber = (date: LocalDate) => floating(date).getTime() / MS_PER_DAY;
const onDayNumber = (n: number) => new Date(n * MS_PER_DAY).toISOString().slice(0, 10) as LocalDate;
/** Monday is 0, as `WEEKDAYS` orders them. */
const weekdayIndex = (date: LocalDate) => (floating(date).getUTCDay() + 6) % 7;

/**
 * Where to start the rule so it yields the same dates from `fromDate` on
 * without stepping through the years before it, and how many occurrences that
 * start passes over, which a `COUNT` still has to spend. Daily and weekly
 * rules advance by whole periods: a daily rule to its last date on or before
 * `fromDate`, a weekly rule to the Monday of its last period starting on or
 * before it, with its weekdays named so the period is drawn whole. Monthly and
 * yearly rules step once a period already, and a month without the day makes
 * their arithmetic irregular, so they start where they began.
 */
function fastForward(rule: Rule, firstOn: LocalDate, fromDate: LocalDate): { start: LocalDate; passed: number; byDay?: Weekday[] } {
  const first = dayNumber(firstOn);
  if (rule.freq === "daily") {
    const periods = Math.floor((dayNumber(fromDate) - first) / rule.interval);
    return periods > 0 ? { start: onDayNumber(first + periods * rule.interval), passed: periods } : { start: firstOn, passed: 0 };
  }
  if (rule.freq !== "weekly") return { start: firstOn, passed: 0 };

  const byDay = rule.byDay.length > 0 ? rule.byDay : [WEEKDAYS[weekdayIndex(firstOn)]];
  const monday = first - weekdayIndex(firstOn);
  const periods = Math.floor((dayNumber(fromDate) - monday) / (7 * rule.interval));
  if (periods <= 0) return { start: firstOn, passed: 0 };
  const inFirstPeriod = byDay.filter((d) => WEEKDAYS.indexOf(d) >= weekdayIndex(firstOn)).length;
  return { start: onDayNumber(monday + periods * 7 * rule.interval), passed: inFirstPeriod + (periods - 1) * byDay.length, byDay };
}

/**
 * The occurrences of a series whose local date falls in `[span.fromDate, span.toDate)`.
 *
 * The rule runs on floating calendar dates (UTC midnights standing for local
 * dates), and each date is placed back on the clock with `instantAt`. So a
 * 09:00 item stays at 09:00 local across daylight-saving changes, and a time
 * the clocks skip moves forward with them. Monthly on the 31st skips months
 * without one, and a weekly rule whose weekdays leave out the first date's
 * weekday does not land on that first date, both as RFC 5545 says.
 */
export function expandSeries(series: SeriesSource, span: SpanRange, timeZone: string): Occurrence[] {
  const s = series.schedule;
  if (s.kind === "unscheduled") return [];
  const firstOn = s.kind === "day" ? s.on : toLocalDate(s.start, timeZone);
  const minutes = s.kind === "timed" ? localMinutes(s.start, firstOn, timeZone) : 0;
  const length = s.kind === "timed" ? s.end.getTime() - s.start.getTime() : 0;

  const { rule } = series;
  const { start, passed, byDay = rule.freq === "weekly" ? rule.byDay : [] } = fastForward(rule, firstOn, span.fromDate);
  const count = rule.end.kind === "count" ? rule.end.count - passed : null;
  if (count !== null && count <= 0) return [];
  const rrule = new RRule({
    freq: FREQ[rule.freq],
    interval: rule.interval,
    dtstart: floating(start),
    wkst: RRule.MO,
    ...(byDay.length > 0 && { byweekday: byDay.map((d) => DAYS[d]) }),
    ...(rule.end.kind === "until" && { until: floating(rule.end.on) }),
    ...(count !== null && { count }),
  });

  // `between` with inc includes both ends; the last instant before toDate keeps the span half-open.
  const dates = rrule.between(
    floating(span.fromDate),
    new Date(floating(span.toDate).getTime() - MS_PER_DAY / 2),
    true,
    (_, i) => i < MAX_OCCURRENCES,
  );

  return dates.map((d) => {
    const originalOn = d.toISOString().slice(0, 10) as LocalDate;
    if (s.kind === "day") return { seriesId: series.id, originalOn, schedule: { kind: "day", on: originalOn } };
    const start = instantAt(originalOn, minutes, timeZone);
    return { seriesId: series.id, originalOn, schedule: { kind: "timed", start, end: new Date(start.getTime() + length) } };
  });
}

/** An override's claim on one occurrence date. Any live override suppresses it, wherever it moved and whatever its status. */
export type OverrideClaim = { seriesId: ItemId; originalOn: LocalDate };

/** Expands every series over the span and drops the occurrences an override already stands for. */
export function liveOccurrences(
  series: SeriesSource[],
  overrides: OverrideClaim[],
  span: SpanRange,
  timeZone: string,
): Occurrence[] {
  const claimed = new Set(overrides.map((o) => occurrenceKey(o.seriesId, o.originalOn)));
  return series
    .flatMap((s) => expandSeries(s, span, timeZone))
    .filter((o) => !claimed.has(occurrenceKey(o.seriesId, o.originalOn)));
}
