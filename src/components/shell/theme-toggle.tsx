"use client";

import { THEME_COOKIE } from "./cookies";
import { ThemeIcon } from "./icons";

function toggleTheme() {
  const root = document.documentElement;
  const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeToggle({ className }: { className: string }) {
  return (
    <button type="button" onClick={toggleTheme} aria-label="Switch between light and dark" className={className}>
      <ThemeIcon />
      <span className="max-rail:sr-only">Theme</span>
    </button>
  );
}
