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
 * writes 24-hour times until the browser has said which it uses.
 */
export function readClock(value: string | undefined): { setting: ClockSetting; clock: Clock } {
  if (value === "12" || value === "24") return { setting: value, clock: value };
  return { setting: "auto", clock: value === "auto-12" ? "12" : "24" };
}

/** The cookie's value for a setting, with the browser's own clock standing in for Auto. */
export function clockCookieValue(setting: ClockSetting, device: Clock): string {
  return setting === "auto" ? `auto-${device}` : setting;
}
