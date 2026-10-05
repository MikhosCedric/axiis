/** The Score's time grid, in minutes. */
export const SNAP_MINUTES = 15;

/** Nearest grid line; a value exactly between two lines goes to the later one. */
export function snap(minutes: number, step = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

/** `value` held inside `[min, max]`. When the range is empty, `min` wins. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
