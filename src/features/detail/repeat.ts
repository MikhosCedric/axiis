// zod/mini: the panel client code imports this module, and classic zod ships every locale with it.
import * as z from "zod/mini";
import { planDateSchema, type LocalDate } from "@/domain/item";
import { addDays, utcMidnight } from "@/lib/dates";
import {
  MAX_COUNT,
  MAX_INTERVAL,
  NTHS,
  WEEKDAYS,
  nextNthWeekday,
  nthsOf,
  sortWeekdays,
  type Nth,
  type NthWeekday,
  type Rule,
  type RuleEnd,
  type Weekday,
} from "@/domain/recurrence";
import { formatDayIn } from "@/features/today/format";
import { dayWords } from "@/features/inbox/model";

/** The repeat choices the detail panel offers, in menu order. */
export const REPEAT_PRESETS = ["none", "daily", "weekdays", "weekly", "biweekly", "monthly", "yearly"] as const;
export type RepeatPreset = (typeof REPEAT_PRESETS)[number];

export const PRESET_LABEL: Record<RepeatPreset, string> = {
  none: "Does not repeat",
  daily: "Every day",
  weekdays: "Every weekday",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
  yearly: "Every year",
};

const WORKWEEK: Weekday[] = ["MO", "TU", "WE", "TH", "FR"];

export const REPEAT_FREQS = ["daily", "weekly", "monthly", "yearly"] as const;

const endSchema = z._default(
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("never") }),
    z.object({ kind: z.literal("until"), on: planDateSchema }),
    z.object({ kind: z.literal("count"), count: z.int().check(z.minimum(1), z.maximum(MAX_COUNT)) }),
  ]),
  { kind: "never" },
);

/**
 * A repeat the panel's editor builds by hand: every N days, weeks, months or
 * years. `byDay` is read for a weekly one only, `onThe` for a monthly one only
 * (null repeats on the first day's day of the month).
 */
const customSchema = z.object({
  freq: z.enum(REPEAT_FREQS),
  interval: z.int().check(z.minimum(1), z.maximum(MAX_INTERVAL)),
  byDay: z.array(z.enum(WEEKDAYS)).check(z.maxLength(WEEKDAYS.length)),
  onThe: z.nullable(z.object({ nth: z.literal([...NTHS]), day: z.enum(WEEKDAYS) })),
});
export type CustomRepeat = z.infer<typeof customSchema>;

/** What the client may send to change how something repeats: a menu choice or a hand-built one. Parsed here, never trusted further. */
export const repeatSchema = z.union([
  z.object({ preset: z.enum(REPEAT_PRESETS), end: endSchema }),
  z.object({ preset: z.literal("custom"), custom: customSchema, end: endSchema }),
]);
export type RepeatChoice = z.infer<typeof repeatSchema>;

export function ruleFor(preset: Exclude<RepeatPreset, "none">, end: RuleEnd): Rule {
  switch (preset) {
    case "daily":
      return { freq: "daily", interval: 1, end };
    case "weekdays":
      return { freq: "weekly", interval: 1, byDay: WORKWEEK, end };
    case "weekly":
      return { freq: "weekly", interval: 1, byDay: [], end };
    case "biweekly":
      return { freq: "weekly", interval: 2, byDay: [], end };
    case "monthly":
      return { freq: "monthly", interval: 1, end };
    case "yearly":
      return { freq: "yearly", interval: 1, end };
  }
}

/** The rule a hand-built repeat stands for. Weekdays are kept for a weekly rule only, a place in the month for a monthly one only. */
export function customRule(custom: CustomRepeat, end: RuleEnd): Rule {
  const { freq, interval } = custom;
  if (freq === "weekly") return { freq, interval, byDay: sortWeekdays(custom.byDay), end };
  if (freq === "monthly" && custom.onThe) return { freq, interval, onThe: custom.onThe, end };
  return { freq, interval, end };
}

/** The rule a choice asks for, or null for "Does not repeat". */
export function ruleOf(choice: RepeatChoice): Rule | null {
  if (choice.preset === "none") return null;
  return choice.preset === "custom" ? customRule(choice.custom, choice.end) : ruleFor(choice.preset, choice.end);
}

/**
 * A rule as the editor shows it, the way back from `customRule`. A weekly rule
 * that names no weekday shows its first day's, which is the day it falls on;
 * the other kinds carry that weekday too, ready for a switch to weeks.
 */
export function customOf(rule: Rule, firstOn: LocalDate): CustomRepeat {
  return {
    freq: rule.freq,
    interval: rule.interval,
    byDay: rule.freq === "weekly" && rule.byDay.length > 0 ? [...rule.byDay] : [weekdayOf(firstOn)],
    onThe: rule.freq === "monthly" ? (rule.onThe ?? null) : null,
  };
}

/**
 * The form a rule is stored in once its first date is known: a weekly rule on
 * the one weekday its first date falls on names no weekday, the form the menu's
 * "Every week" makes, so the two read as the same choice.
 */
export function settledRule(rule: Rule, firstOn: LocalDate): Rule {
  if (rule.freq === "weekly" && rule.byDay.length === 1 && rule.byDay[0] === weekdayOf(firstOn)) return { ...rule, byDay: [] };
  return rule;
}

/** The menu choice a rule matches, or null for a rule only the editor can make. */
export function presetOf(rule: Rule): Exclude<RepeatPreset, "none"> | null {
  if (rule.freq === "monthly" && rule.onThe) return null;
  for (const preset of REPEAT_PRESETS) {
    if (preset === "none") continue;
    const made = ruleFor(preset, rule.end);
    if (
      made.freq === rule.freq &&
      made.interval === rule.interval &&
      (made.freq !== "weekly" || (rule.freq === "weekly" && made.byDay.join() === rule.byDay.join()))
    ) {
      return preset;
    }
  }
  return null;
}

export const DAY_NAME: Record<Weekday, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};
export const UNIT = { daily: "day", weekly: "week", monthly: "month", yearly: "year" } as const;
const NTH_WORD: Record<Nth, string> = { 1: "first", 2: "second", 3: "third", 4: "fourth", [-1]: "last" };

/** "second Tuesday", "last Friday". */
export function nthWords(onThe: NthWeekday): string {
  return `${NTH_WORD[onThe.nth]} ${DAY_NAME[onThe.day]}`;
}

/** One way a monthly repeat can fall, as the editor's menu offers it. `onThe` is null for the day of the month. */
export type MonthlyChoice = { value: string; label: string; onThe: NthWeekday | null };

/**
 * The ways a monthly repeat can fall, read off its first day: on that day of
 * the month, or on that weekday by its place ("On the second Saturday", and "On
 * the last Saturday" when no later one is left in the month). A fifth weekday
 * is only ever offered as the last. The rule's own place is kept in the list
 * when the first day has since moved off it.
 */
export function monthlyChoices(firstOn: LocalDate, current: NthWeekday | null): MonthlyChoice[] {
  const day = weekdayOf(firstOn);
  const places: NthWeekday[] = nthsOf(firstOn).map((nth) => ({ nth, day }));
  if (current && !places.some((p) => p.nth === current.nth && p.day === current.day)) places.push(current);
  return [
    { value: "day", label: `On day ${Number(firstOn.slice(8))}`, onThe: null },
    ...places.map((onThe) => ({ value: `${onThe.nth}${onThe.day}`, label: `On the ${nthWords(onThe)}`, onThe })),
  ];
}

/** The weekday of a local date, as a rule names it. */
export function weekdayOf(date: LocalDate): Weekday {
  return WEEKDAYS[(new Date(utcMidnight(date)).getUTCDay() + 6) % 7];
}

/** One or two weekdays are named whole ("Monday and Thursday"); three or more are a short list ("Mon, Wed, Fri"), so a row stays one line. */
function listDays(days: Weekday[]): string {
  const names = days.map((d) => DAY_NAME[d]);
  if (names.length > 2) return names.map((n) => n.slice(0, 3)).join(", ");
  return names.join(" and ");
}

/**
 * How often a rule repeats, mid-sentence: "every weekday", "every 2 weeks on
 * Monday", "every 3 weeks on Mon, Wed, Fri", "every second Tuesday of the
 * month", "every 3 months on the last Friday".
 */
export function cadence(rule: Rule, firstOn: LocalDate | null): string {
  if (presetOf(rule) === "weekdays") return "every weekday";
  const every = rule.interval === 1 ? `every ${UNIT[rule.freq]}` : `every ${rule.interval} ${UNIT[rule.freq]}s`;
  if (rule.freq === "monthly" && rule.onThe) {
    // "Of the month" keeps "every second Tuesday" from reading as every other week.
    return rule.interval === 1 ? `every ${nthWords(rule.onThe)} of the month` : `${every} on the ${nthWords(rule.onThe)}`;
  }
  if (rule.freq !== "weekly") return every;
  const days = rule.byDay.length > 0 ? rule.byDay : firstOn ? [weekdayOf(firstOn)] : [];
  return days.length > 0 ? `${every} on ${listDays(days)}` : every;
}

/**
 * The first date on or after `from` that a rule repeats on: a weekday rule set
 * on a Saturday starts on Monday, and one on the second Tuesday of the month
 * starts on the next of those.
 */
export function firstOccurrence(rule: Rule, from: LocalDate): LocalDate {
  if (rule.freq === "monthly" && rule.onThe) return nextNthWeekday(rule.onThe, from);
  if (rule.freq !== "weekly" || rule.byDay.length === 0) return from;
  let on = from;
  while (!rule.byDay.includes(weekdayOf(on))) on = addDays(on, 1);
  return on;
}

/**
 * What the status line says when something starts repeating: "Repeats every day
 * from today", or "Repeats every weekday, starting Monday 12 October" when its
 * own day is not one. A waiting item starts today, as `setRepeat` puts it there.
 */
export function startsRepeating(choice: RepeatChoice, day: LocalDate | null, today: LocalDate): string | null {
  const rule = ruleOf(choice);
  if (!rule) return null;
  const from = day ?? today;
  const first = firstOccurrence(rule, from);
  const every = cadence(rule, from);
  const starts = first === from ? `Repeats ${every} from ${dayWords(from, today)}.` : `Repeats ${every}, starting ${dayWords(first, today)}.`;
  const note = skippedNote(rule, first);
  return note ? `${starts} ${note}` : starts;
}

/**
 * The months or years a rule passes over because they lack its date: a
 * monthly rule on the 31st has nothing in April, and a yearly one on
 * 29 February only comes in leap years. Null when every one has it.
 */
function skippedNote(rule: Rule, firstOn: LocalDate | null): string | null {
  if (!firstOn) return null;
  const [, month, day] = firstOn.split("-").map(Number);
  if (rule.freq === "monthly" && !rule.onThe && day >= 29) return `Months with no ${day === 31 ? "31st" : `${day}th`} are skipped.`;
  if (rule.freq === "yearly" && month === 2 && day === 29) return "Years with no 29 February are skipped.";
  return null;
}

/**
 * A plain sentence for a rule, such as "Every 2 weeks on Monday, until
 * Thursday 31 December", followed by any months or years it skips. An end in
 * another year than `today` names its year.
 */
export function describeRule(rule: Rule, firstOn: LocalDate | null, today: LocalDate): string {
  const every = `E${cadence(rule, firstOn).slice(1)}`;
  const ends =
    rule.end.kind === "until"
      ? `${every}, until ${formatDayIn(rule.end.on, today)}`
      : rule.end.kind === "count"
        ? `${every}, ${rule.end.count === 1 ? "once" : `${rule.end.count} times`}`
        : every;
  const note = skippedNote(rule, firstOn);
  return note ? `${ends}. ${note}` : ends;
}
