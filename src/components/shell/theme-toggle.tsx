"use client";

import { useSyncExternalStore } from "react";
import { readTheme, THEME_COOKIE, type Theme } from "./cookies";
import { ThemeIcon } from "./icons";

/** Sets the theme on this page and in the cookie the root layout's script reads before first paint. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    delete root.dataset.theme;
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    root.dataset.theme = theme;
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  }
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

/** The theme chosen on this device, kept current when the rail's toggle changes it. */
export function useTheme(initial: Theme): Theme {
  return useSyncExternalStore(
    subscribe,
    () => readTheme(document.documentElement.dataset.theme),
    () => initial,
  );
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  applyTheme(current === "dark" ? "light" : "dark");
}

export function ThemeToggle({ className }: { className: string }) {
  return (
    <button type="button" onClick={toggleTheme} aria-label="Theme, switch between light and dark" className={className}>
      <ThemeIcon />
      <span>Theme</span>
    </button>
  );
}
