import { z } from "zod";
import { planDateSchema, type LocalDate } from "@/domain/item";
import { addDays, utcMidnight } from "@/lib/dates";
import { MAX_COUNT, WEEKDAYS, type Rule, type RuleEnd, type Weekday } from "@/domain/recurrence";
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

/** What the client may send to change how something repeats. Parsed here, never trusted further. */
export const repeatSchema = z.object({
  preset: z.enum(REPEAT_PRESETS),
  end: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("never") }),
      z.object({ kind: z.literal("until"), on: planDateSchema }),
      z.object({ kind: z.literal("count"), count: z.number().int().min(1).max(MAX_COUNT) }),
    ])
    .default({ kind: "never" }),
});
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

/** The menu choice a rule matches, or null for a rule the menu cannot make (it still repeats as stored). */
export function presetOf(rule: Rule): Exclude<RepeatPreset, "none"> | null {
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

const DAY_NAME: Record<Weekday, string> = {
  MO: "Monday",
  TU: "Tuesday",
  WE: "Wednesday",
  TH: "Thursday",
  FR: "Friday",
  SA: "Saturday",
  SU: "Sunday",
};
const UNIT = { daily: "day", weekly: "week", monthly: "month", yearly: "year" } as const;

/** The weekday of a local date, as a rule names it. */
export function weekdayOf(date: LocalDate): Weekday {
  return WEEKDAYS[(new Date(utcMidnight(date)).getUTCDay() + 6) % 7];
}

function listDays(days: Weekday[]): string {
  const names = days.map((d) => DAY_NAME[d]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** How often a rule repeats, mid-sentence: "every weekday", "every 2 weeks on Monday". */
export function cadence(rule: Rule, firstOn: LocalDate | null): string {
  if (presetOf(rule) === "weekdays") return "every weekday";
  const every = rule.interval === 1 ? `every ${UNIT[rule.freq]}` : `every ${rule.interval} ${UNIT[rule.freq]}s`;
  if (rule.freq !== "weekly") return every;
  const days = rule.byDay.length > 0 ? rule.byDay : firstOn ? [weekdayOf(firstOn)] : [];
  return days.length > 0 ? `${every} on ${listDays(days)}` : every;
}

/** The first date on or after `from` that a rule repeats on: a weekday rule set on a Saturday starts on Monday. */
export function firstOccurrence(rule: Rule, from: LocalDate): LocalDate {
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
  if (choice.preset === "none") return null;
  const from = day ?? today;
  const rule = ruleFor(choice.preset, choice.end);
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
  if (rule.freq === "monthly" && day >= 29) return `Months with no ${day === 31 ? "31st" : `${day}th`} are skipped.`;
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
