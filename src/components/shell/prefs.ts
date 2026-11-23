import { DENSITY_COOKIE, REMINDERS_COOKIE, WEEK_START_COOKIE, type Density, type WeekStartSetting } from "./cookies";

const YEAR = "path=/; max-age=31536000; samesite=lax";

/** Keeps the row spacing on this page and in the cookie the server reads. */
export function saveDensity(next: Density) {
  document.documentElement.dataset.density = next;
  document.cookie = `${DENSITY_COOKIE}=${next}; ${YEAR}`;
}

/** Keeps the first day of the week in its cookie. The Week and the Month are drawn on the server, so the caller refreshes. */
export function saveWeekStart(next: WeekStartSetting) {
  document.cookie = `${WEEK_START_COOKIE}=${next}; ${YEAR}`;
}

/** Keeps whether the desktop app speaks reminders. The reminders ride on the page, so the caller refreshes. */
export function saveReminders(on: boolean) {
  document.cookie = `${REMINDERS_COOKIE}=${on ? "on" : "off"}; ${YEAR}`;
}
