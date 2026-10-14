export const THEME_COOKIE = "theme";
export const TZ_COOKIE = "tz";
export const DENSITY_COOKIE = "density";

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
export function readTheme(value: string | undefined): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
