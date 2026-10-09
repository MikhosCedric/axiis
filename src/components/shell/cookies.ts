export const THEME_COOKIE = "theme";
export const TZ_COOKIE = "tz";
export const DENSITY_COOKIE = "density";

export const DENSITIES = ["spacious", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

/** The saved density, or spacious for a missing or unknown value. */
export function readDensity(value: string | undefined): Density {
  return value === "compact" ? "compact" : "spacious";
}
