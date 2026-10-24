"use client";

import { applyTheme } from "@/components/shell/theme-toggle";

function DayNightIcon() {
  // A horizon: by day the sun stands over it, by night a crescent; the CSS picks which from the theme in effect.
  return (
    <svg viewBox="0 0 20 20" width={20} height={20} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <path d="M2.5 15.5h15" />
      <g className="day-night-sun">
        <circle cx="10" cy="9" r="3.2" />
        <path d="M10 2.6v1.2M4.6 4.6l.85.85M15.4 4.6l-.85.85M3 9h1.2M15.8 9H17" />
      </g>
      <path className="day-night-moon" d="M12.6 4.2a4.6 4.6 0 1 0 2.9 7.3 3.8 3.8 0 0 1-2.9-7.3Z" />
    </svg>
  );
}

function turn() {
  const root = document.documentElement;
  const dark = (root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  const change = () => applyTheme(dark ? "light" : "dark");
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    change();
    return;
  }
  root.dataset.themeTurn = "";
  const transition = document.startViewTransition(change);
  transition.finished.finally(() => delete root.dataset.themeTurn);
}

/** The public pages' day and night switch. Same setting as the app's, drawn in across the page from the left. */
export function DayNight() {
  return (
    <button
      type="button"
      onClick={turn}
      aria-label="Switch between light and dark"
      className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink-2 hover:bg-hover hover:text-ink active:bg-press"
    >
      <DayNightIcon />
    </button>
  );
}
