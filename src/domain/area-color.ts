/**
 * The colours an area can carry. Each name is a design token (`--area-<name>` in
 * globals.css) and a value of the `areas_color_palette` check in migration 0009,
 * so adding one means all three. Null, shown as None, is the ink look.
 */
export const AREA_COLORS = ["clay", "ochre", "moss", "sage", "slate", "plum", "rose", "stone"] as const;

export type AreaColor = (typeof AREA_COLORS)[number];

const known: ReadonlySet<string> = new Set(AREA_COLORS);

export function isAreaColor(value: unknown): value is AreaColor {
  return typeof value === "string" && known.has(value);
}

/** The name a person reads, in a picker or a label. */
export function areaColorLabel(color: AreaColor | null): string {
  return color === null ? "None" : color.charAt(0).toUpperCase() + color.slice(1);
}
