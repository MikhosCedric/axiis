import type { LocalDate } from "./item";

export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const MAX_INTERVAL = 99;
export const MAX_COUNT = 1000;

/** When a series stops: never, after its last occurrence on or before a date, or after a number of occurrences. */
export type RuleEnd = { kind: "never" } | { kind: "until"; on: LocalDate } | { kind: "count"; count: number };

/**
 * The allowlisted slice of RFC 5545 that Axiis repeats with. Only a weekly
 * rule names weekdays; an empty `byDay` repeats on the first occurrence's weekday.
 */
export type Rule =
  | { freq: "weekly"; interval: number; byDay: Weekday[]; end: RuleEnd }
  | { freq: "daily" | "monthly" | "yearly"; interval: number; end: RuleEnd };

export type Freq = Rule["freq"];

const FREQS: Record<string, Freq> = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" };
const KEYS = new Set(["FREQ", "INTERVAL", "BYDAY", "UNTIL", "COUNT"]);
const MAX_LENGTH = 200;

function untilDate(raw: string): LocalDate | null {
  if (!/^\d{8}$/.test(raw)) return null;
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const t = new Date(0);
  t.setUTCFullYear(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8)));
  return t.toISOString().slice(0, 10) === iso ? (iso as LocalDate) : null;
}

/** Parses a stored rule. Anything outside the allowlist (BYSETPOS, BYHOUR, EXDATE, ordinals, a time on UNTIL) is null. */
export function parseRule(raw: string): Rule | null {
  if (raw.length === 0 || raw.length > MAX_LENGTH) return null;
  const parts = new Map<string, string>();
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) return null;
    const key = part.slice(0, eq);
    if (!KEYS.has(key) || parts.has(key)) return null;
    parts.set(key, part.slice(eq + 1));
  }

  const freq = FREQS[parts.get("FREQ") ?? ""];
  if (!freq) return null;

  let interval = 1;
  const rawInterval = parts.get("INTERVAL");
  if (rawInterval !== undefined) {
    if (!/^[1-9]\d?$/.test(rawInterval)) return null;
    interval = Number(rawInterval);
  }

  let end: RuleEnd = { kind: "never" };
  const rawUntil = parts.get("UNTIL");
  const rawCount = parts.get("COUNT");
  if (rawUntil !== undefined && rawCount !== undefined) return null;
  if (rawUntil !== undefined) {
    const on = untilDate(rawUntil);
    if (!on) return null;
    end = { kind: "until", on };
  }
  if (rawCount !== undefined) {
    if (!/^[1-9]\d{0,3}$/.test(rawCount) || Number(rawCount) > MAX_COUNT) return null;
    end = { kind: "count", count: Number(rawCount) };
  }

  const rawByDay = parts.get("BYDAY");
  if (freq !== "weekly") return rawByDay === undefined ? { freq, interval, end } : null;
  const byDay: Weekday[] = [];
  if (rawByDay !== undefined) {
    for (const day of rawByDay.split(",")) {
      if (!(WEEKDAYS as readonly string[]).includes(day) || byDay.includes(day as Weekday)) return null;
      byDay.push(day as Weekday);
    }
  }
  return { freq, interval, byDay: sortWeekdays(byDay), end };
}

export function sortWeekdays(days: readonly Weekday[]): Weekday[] {
  return WEEKDAYS.filter((d) => days.includes(d));
}

/** The canonical string the database's allowlist check accepts. */
export function serializeRule(rule: Rule): string {
  const parts = [`FREQ=${rule.freq.toUpperCase()}`];
  if (rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === "weekly" && rule.byDay.length > 0) parts.push(`BYDAY=${sortWeekdays(rule.byDay).join(",")}`);
  if (rule.end.kind === "until") parts.push(`UNTIL=${rule.end.on.replaceAll("-", "")}`);
  if (rule.end.kind === "count") parts.push(`COUNT=${rule.end.count}`);
  return parts.join(";");
}
