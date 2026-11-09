import { MAX_INTERVAL, sortWeekdays, type Freq, type Weekday } from "@/domain/recurrence";

/**
 * How often a captured line repeats, as typed: the rule's cadence before it
 * is pinned to a first day. `byDay` names weekdays for a weekly repeat only;
 * empty, a weekly repeat falls on its first day's weekday.
 */
export type Cadence = { freq: Freq; interval: number; byDay: Weekday[] };

/** Sunday first, as `getUTCDay` and capture's own weekdays count. */
const RULE_DAYS: readonly Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
export const ruleDay = (weekday: number): Weekday => RULE_DAYS[weekday];

const FULL_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_WORDS = new Map<string, number>([
  ...FULL_DAYS.map((name, i) => [name, i] as const),
  ...(["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const).map((name, i) => [name, i] as const),
  ["tues", 2],
  ["weds", 3],
  ["thur", 4],
  ["thurs", 4],
]);

export const WORKWEEK: readonly Weekday[] = ["MO", "TU", "WE", "TH", "FR"];
export const WEEKEND: readonly Weekday[] = ["SA", "SU"];

function weekdayWord(word: string): { day: number; plural: boolean } | null {
  const day = DAY_WORDS.get(word);
  if (day !== undefined) return { day, plural: false };
  const one = word.endsWith("s") ? FULL_DAYS.indexOf(word.slice(0, -1)) : -1;
  return one >= 0 ? { day: one, plural: true } : null;
}

/**
 * Weekdays named as a list or a range, every word a weekday: "mon, wed and
 * fri", "mon/wed/fri", "mon-fri", "monday to friday", "tue & thu",
 * "mondays and thursdays". `plural` is set when a name was plural ("tuesdays").
 */
export function weekdayList(text: string): { days: number[]; plural: boolean } | null {
  const ranged = text.replace(/\s*(?:-|–|\bto\b|\bthrough\b|\bthru\b)\s*/g, "~");
  const parts = ranged.split(/\s*,\s*(?:and\s+|&\s*)?|\s*[/&+]\s*|\s+and\s+|\s+/);
  const days = new Set<number>();
  let plural = false;
  for (const part of parts) {
    const ends = part.split("~").map(weekdayWord);
    if (ends.length > 2 || ends.some((w) => w === null)) return null;
    const [from, to = from] = ends as { day: number; plural: boolean }[];
    plural ||= from.plural || to.plural;
    for (let d = from.day; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === to.day) break;
    }
  }
  return { days: [...days], plural };
}

const weekly = (interval: number, days: readonly number[]): Cadence => ({
  freq: "weekly",
  interval,
  byDay: sortWeekdays(days.map(ruleDay)),
});

/** Single words that say how often. Read only at a line's end, as one that opens a line is a name: "weekly review". */
const ADVERBS = new Map<string, [Freq, number]>([
  ["daily", ["daily", 1]],
  ["nightly", ["daily", 1]],
  ["weekly", ["weekly", 1]],
  ["fortnightly", ["weekly", 2]],
  ["biweekly", ["weekly", 2]],
  ["monthly", ["monthly", 1]],
  ["quarterly", ["monthly", 3]],
  ["yearly", ["yearly", 1]],
  ["annually", ["yearly", 1]],
]);

/** "every other", "every 2nd", "every 3": the interval a repeat skips by. */
const ORDINALS = new Map<string, number>([
  ["other", 2],
  ["second", 2],
  ["2nd", 2],
  ["third", 3],
  ["3rd", 3],
  ["fourth", 4],
  ["4th", 4],
]);

function everyHit(rest: string): Cadence | null {
  const m = /^(?:(\d{1,2}|other|second|2nd|third|3rd|fourth|4th) )?(.+)$/.exec(rest)!;
  const interval = m[1] === undefined ? 1 : (ORDINALS.get(m[1]) ?? Number(m[1]));
  if (interval < 1 || interval > MAX_INTERVAL) return null;
  const unit = m[2];
  if (/^(?:days?|mornings?|evenings?|nights?|afternoons?)$/.test(unit)) return { freq: "daily", interval, byDay: [] };
  // "every other weekday" could mean several things, so only a plain one is read.
  if (/^(?:week ?days?|work ?days?)$/.test(unit)) return interval === 1 ? { freq: "weekly", interval, byDay: [...WORKWEEK] } : null;
  if (/^weekends?$/.test(unit)) return { freq: "weekly", interval, byDay: [...WEEKEND] };
  const week = /^weeks?(?: on (.+))?$/.exec(unit);
  if (week) {
    if (week[1] === undefined) return { freq: "weekly", interval, byDay: [] };
    const list = weekdayList(week[1]);
    return list && weekly(interval, list.days);
  }
  if (/^months?$/.test(unit)) return { freq: "monthly", interval, byDay: [] };
  if (/^years?$/.test(unit)) return { freq: "yearly", interval, byDay: [] };
  const list = weekdayList(unit);
  return list && weekly(interval, list.days);
}

/**
 * A phrase that says a line repeats: "every day", "weekdays", "every other
 * tuesday", "mon/wed/fri", "tuesdays", "every 3 months", "weekly on monday".
 * One weekday alone ("tuesday") is a day, not a repeat; two or more, or a
 * plural, can only mean a repeat. `adverb` marks a lone "daily" or "weekly".
 */
export function cadenceHit(p: string): (Cadence & { adverb: boolean }) | null {
  const single = /^([a-z]+)(?: on (.+))?$/.exec(p);
  const adverb = single ? ADVERBS.get(single[1]) : undefined;
  if (single && adverb) {
    const [freq, interval] = adverb;
    if (single[2] === undefined) return { freq, interval, byDay: [], adverb: true };
    const list = freq === "weekly" ? weekdayList(single[2]) : null;
    return list && { ...weekly(interval, list.days), adverb: false };
  }
  if (p === "everyday") return { freq: "daily", interval: 1, byDay: [], adverb: false };
  if (/^(?:on )?(?:weekdays|workdays)$/.test(p)) return { freq: "weekly", interval: 1, byDay: [...WORKWEEK], adverb: false };
  if (/^(?:on )?weekends$/.test(p)) return { freq: "weekly", interval: 1, byDay: [...WEEKEND], adverb: false };
  const every = /^(?:every|each) (.+)$/.exec(p);
  if (every) {
    const cadence = everyHit(every[1]);
    return cadence && { ...cadence, adverb: false };
  }
  const list = weekdayList(p.replace(/^on /, ""));
  return list && (list.plural || list.days.length > 1) ? { ...weekly(1, list.days), adverb: false } : null;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** 1 for "jan" or "january", up to 12; null for any other word. */
export function monthWord(word: string): number | null {
  const w = word.replace(/\.$/, "");
  const i = MONTHS.findIndex((name) => name === w || (w.length >= 3 && name.slice(0, w.length) === w && (w.length === 3 || w === "sept")));
  return i < 0 ? null : i + 1;
}

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A date by its day and month, with a year only when one was typed: "20 dec", "december 20th", "the 20th of december 2027". */
export function dateWords(p: string): { month: number; day: number; year: number | null } | null {
  const dayFirst = /^(?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+\.?)(?:,? (\d{4}))?$/.exec(p);
  const monthFirst = dayFirst ? null : /^([a-z]+\.?) (?:the )?(\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/.exec(p);
  if (!dayFirst && !monthFirst) return null;
  const [day, month, year] = dayFirst ? [dayFirst[1], dayFirst[2], dayFirst[3]] : [monthFirst![2], monthFirst![1], monthFirst![3]];
  const m = monthWord(month);
  const d = Number(day);
  if (m === null || d < 1 || d > MONTH_DAYS[m - 1]) return null;
  return { month: m, day: d, year: year === undefined ? null : Number(year) };
}

/** "Monday", "Monday and Thursday", "Monday, Wednesday and Friday". */
export function weekdayNames(days: readonly Weekday[]): string {
  const names = days.map((d) => {
    const name = FULL_DAYS[RULE_DAYS.indexOf(d)];
    return name[0].toUpperCase() + name.slice(1);
  });
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function monthName(month: number): string {
  const name = MONTHS[month - 1];
  return name[0].toUpperCase() + name.slice(1);
}

const UNIT = { daily: "day", weekly: "week", monthly: "month", yearly: "year" } as const;

/**
 * How often, mid-sentence: "every day", "every other Tuesday", "every
 * weekday", "every 3 weeks on Monday and Thursday", "every month". A weekly
 * repeat with no weekdays names `firstOn`'s when it is known.
 */
export function cadenceWords(cadence: Cadence, firstWeekday: Weekday | null): string {
  const { freq, interval } = cadence;
  const every = interval === 1 ? "every" : interval === 2 ? "every other" : `every ${interval}`;
  const unit = interval > 2 ? `${UNIT[freq]}s` : UNIT[freq];
  if (freq !== "weekly") return `${every} ${unit}`;
  const days = cadence.byDay.length > 0 ? cadence.byDay : firstWeekday ? [firstWeekday] : [];
  const same = (set: readonly Weekday[]) => days.length === set.length && set.every((d) => days.includes(d));
  if (interval === 1 && same(WORKWEEK)) return "every weekday";
  if (interval <= 2 && same(WEEKEND)) return `${every} weekend`;
  if (days.length === 0) return `${every} ${unit}`;
  return interval > 2 ? `${every} ${unit} on ${weekdayNames(days)}` : `${every} ${weekdayNames(days)}`;
}
