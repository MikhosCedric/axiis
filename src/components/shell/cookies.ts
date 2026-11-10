import type { WeekStart } from "@/features/week/week-of";
import type { Clock } from "@/lib/clock";

export const THEME_COOKIE = "theme";
export const TZ_COOKIE = "tz";
/** "min" once the sidebar is folded down to icons. */
export const RAIL_COOKIE = "rail";
export const DENSITY_COOKIE = "density";
export const CLOCK_COOKIE = "clock";
export const FOCUS_COOKIE = "focus";
export const TOUR_COOKIE = "tour";
/** "off" once the suggestion to colour areas is dismissed. */
export const COLOR_HINT_COOKIE = "colour-hint";
/** "off" once desktop reminders are turned off in Settings. Only the desktop app reads reminders at all. */
export const REMINDERS_COOKIE = "reminders";
/** The cookie the desktop shell sets on its pages. */
export const DESKTOP_COOKIE = "axiis_desktop";

/** Desktop reminders are on unless turned off. */
export function readReminders(value: string | undefined): boolean {
  return value !== "off";
}

/**
 * Whether Today shows the tour: on a new account until it is finished or skipped ("done"), and on any
 * account once the Guide asks for it again ("replay").
 */
export function readTour(value: string | undefined, firstDay: boolean): boolean {
  return value === "replay" || (firstDay && value !== "done");
}

/** Focus on Today, as this device last left it. Off for a missing or unknown value. */
export function readFocus(value: string | undefined): boolean {
  return value === "on";
}

export const DENSITIES = ["spacious", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

/** The saved density, or spacious for a missing or unknown value. */
export function readDensity(value: string | undefined): Density {
  return value === "compact" ? "compact" : "spacious";
}

/** "system" is no cookie at all: the page follows the device's light or dark setting. */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** The saved theme, or system for a missing or unknown value. */
export function readRailMin(value: string | undefined): boolean {
  return value === "min";
}

export function readTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

/** "auto" follows the browser's language and region; the other two are chosen in Settings. */
export const CLOCK_SETTINGS = ["auto", "12", "24"] as const;
export type ClockSetting = (typeof CLOCK_SETTINGS)[number];

/**
 * The clock cookie holds the choice, "12" or "24", or under Auto the clock the
 * browser last reported, "auto-12" or "auto-24". With no cookie yet the server
 * writes `guess`, the clock the request's language uses (see `headerClock`),
 * until the browser has said which it uses.
 */
export function readClock(value: string | undefined, guess: Clock = "24"): { setting: ClockSetting; clock: Clock } {
  if (value === "12" || value === "24") return { setting: value, clock: value };
  return { setting: "auto", clock: value === "auto-12" ? "12" : value === "auto-24" ? "24" : guess };
}

/** The day a week begins on, as `Date#getUTCDay` numbers it: 1 is Monday, 0 is Sunday. */
export const WEEK_START_COOKIE = "week-start";
export const WEEK_STARTS = ["monday", "sunday"] as const;
export type WeekStartSetting = (typeof WEEK_STARTS)[number];

/** The saved first day of the week, or Monday, as Axiis has always drawn it, for a missing or unknown value. */
export function readWeekStart(value: string | undefined): WeekStart {
  return value === "sunday" ? 0 : 1;
}

export const weekStartSetting = (start: WeekStart): WeekStartSetting => (start === 0 ? "sunday" : "monday");

/** The page the app opens on at its root and after sign-in. */
export const START_PAGE_COOKIE = "start-page";
export const START_PAGES = ["today", "week", "month", "inbox", "due"] as const;
export type StartPage = (typeof START_PAGES)[number];

/** The saved start page, or Today for a missing or unknown value. */
export function readStartPage(value: string | undefined): StartPage {
  return (START_PAGES as readonly string[]).includes(value ?? "") ? (value as StartPage) : "today";
}

/** The path a start page opens. Only these fixed paths, never one read from the cookie, so it cannot lead off the app. */
export function startPath(page: StartPage): string {
  return `/${page}`;
}

/** The cookie's value for a setting, with the browser's own clock standing in for Auto. */
export function clockCookieValue(setting: ClockSetting, device: Clock): string {
  return setting === "auto" ? `auto-${device}` : setting;
}
