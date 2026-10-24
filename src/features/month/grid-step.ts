import { WEEK_LENGTH } from "@/features/week/week-of";

/**
 * Where a key press moves the grid's focus, as a day offset, or "month" for a
 * whole month either way, or null when the key means nothing to the grid.
 * Home and End go to the ends of the focused week.
 */
export function gridStep(key: string, index: number): { days: number } | { months: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { days: -1 };
    case "ArrowRight":
      return { days: 1 };
    case "ArrowUp":
      return { days: -WEEK_LENGTH };
    case "ArrowDown":
      return { days: WEEK_LENGTH };
    case "Home":
      return { days: -(index % WEEK_LENGTH) };
    case "End":
      return { days: WEEK_LENGTH - 1 - (index % WEEK_LENGTH) };
    case "PageUp":
      return { months: -1 };
    case "PageDown":
      return { months: 1 };
    default:
      return null;
  }
}
