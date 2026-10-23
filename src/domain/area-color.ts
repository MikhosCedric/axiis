/**
 * The colours an area or a tag can carry, in picker order (warm to cool, then the neutral).
 * Each name is a design token (`--area-<name>` in globals.css) and a value of the
 * `areas_color_palette` and `tags_color_palette` checks in migration 0011, so adding one
 * means all three. Null, shown as None, is the ink look.
 */
export const AREA_COLORS = [
  "clay",
  "terracotta",
  "ochre",
  "mustard",
  "moss",
  "sage",
  "slate",
  "indigo",
  "plum",
  "mauve",
  "rose",
  "stone",
] as const;

export type AreaColor = (typeof AREA_COLORS)[number];

const known: ReadonlySet<string> = new Set(AREA_COLORS);

export function isAreaColor(value: unknown): value is AreaColor {
  return typeof value === "string" && known.has(value);
}

/** The name a person reads, in a picker or a label. */
export function areaColorLabel(color: AreaColor | null): string {
  return color === null ? "None" : color.charAt(0).toUpperCase() + color.slice(1);
}
